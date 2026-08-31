import * as THREE from "three";
import { buildPrefabMesh, rotationTupleToQuaternion } from "./PrefabMeshBuilder.js";
import { getBlockDef } from "./BlockCatalog.js";
import { loadBlockyModel } from "./BlockyModelLoader.js";

const CUBE_GEOMETRY = new THREE.BoxGeometry(1, 1, 1);
const IDENTITY_SCALE = new THREE.Vector3(1, 1, 1);
const MODEL_OFFSET = new THREE.Matrix4().makeTranslation(0, -0.5, 0);
const MODEL_LOAD_CONCURRENCY = 10;

const isRenderableBlock = (block) => {
	const name = String(block?.name || "").replace(/^\*/, "");
	return Boolean(name && name !== "Empty" && Number(block?.filler || 0) === 0);
};

const resolveModelTexturePath = (value) => {
	if(typeof value === "string") {
		return value;
	}

	if(Array.isArray(value)) {
		return value.find((entry) => entry?.Texture || entry?.texture)?.Texture || value.find((entry) => entry?.Texture || entry?.texture)?.texture || null;
	}

	return value?.Texture || value?.texture || null;
};

const getModelTint = (definition, blockName) => {
	const explicitTint = definition?.tint || definition?.tintUp || null;
	if(explicitTint) {
		return explicitTint;
	}

	const texture = resolveModelTexturePath(definition?.customModelTexture) || "";
	const model = definition?.customModel || definition?.itemModel || "";
	return /_GS\.png$|Plant_Grass|Grassplant|Foliage\/Grass|Foliage\/Plants\/Cross/i.test(`${texture} ${model} ${blockName}`) ? "#67b62d" : null;
};

const applyTrapdoorPose = (model, blockName) => {
	if(!/Trapdoor/i.test(blockName)) {
		return;
	}

	const isOpen = /_State_Definitions_Open|_State_Open/i.test(blockName);
	const quaternion = isOpen ? new THREE.Quaternion(0.707107, 0, 0, 0.707107) : new THREE.Quaternion(0, 0, 0, 1);
	model.traverse((child) => {
		if(child.name === "Door") {
			child.quaternion.copy(quaternion);
		}
	});
};

const getBlockMatrix = (block, target) => {
	const x = (Number(block?.x) || 0) + 0.5;
	const y = (Number(block?.y) || 0) + 0.5;
	const z = (Number(block?.z) || 0) + 0.5;
	if(!Number(block?.rotation)) {
		return target.makeTranslation(x, y, z);
	}

	const position = new THREE.Vector3(
		x,
		y,
		z,
	);
	const rotation = rotationTupleToQuaternion(block?.rotation);
	return target.compose(position, rotation, IDENTITY_SCALE);
};

const addCubeInstances = (root, blocks, materials, resources) => {
	const mesh = new THREE.InstancedMesh(CUBE_GEOMETRY, materials, blocks.length);
	const matrix = new THREE.Matrix4();
	for(let index = 0; index < blocks.length; index += 1) {
		mesh.setMatrixAt(index, getBlockMatrix(blocks[index], matrix));
	}

	mesh.instanceMatrix.setUsage(THREE.StaticDrawUsage);
	mesh.instanceMatrix.needsUpdate = true;
	mesh.castShadow = true;
	mesh.receiveShadow = true;
	root.add(mesh);
	resources.push(mesh);
};

const addModelInstances = (root, blocks, model, resources) => {
	model.updateMatrixWorld(true);
	const placement = new THREE.Matrix4();
	const blockBase = new THREE.Matrix4();
	const instanceMatrix = new THREE.Matrix4();

	model.traverse((child) => {
		if(!child.isMesh || !child.geometry || !child.material) {
			return;
		}

		const mesh = new THREE.InstancedMesh(child.geometry, child.material, blocks.length);
		for(let index = 0; index < blocks.length; index += 1) {
			getBlockMatrix(blocks[index], placement);
			blockBase.copy(placement).multiply(MODEL_OFFSET);
			instanceMatrix.copy(blockBase).multiply(child.matrixWorld);
			mesh.setMatrixAt(index, instanceMatrix);
		}

		mesh.instanceMatrix.setUsage(THREE.StaticDrawUsage);
		mesh.instanceMatrix.needsUpdate = true;
		mesh.castShadow = blocks.length <= 2_048;
		mesh.receiveShadow = true;
		mesh.renderOrder = child.renderOrder;
		root.add(mesh);
		resources.push(mesh);
	});
};

const addFluidInstances = (root, fluids, getMaterials, resources) => {
	const fluidCells = new Map();
	for(const fluid of fluids) {
		const name = String(fluid?.name || "");
		if(!name || name === "Empty") {
			continue;
		}

		const coordinate = `${Number(fluid.x) || 0}:${Number(fluid.y) || 0}:${Number(fluid.z) || 0}`;
		const current = fluidCells.get(coordinate);
		if(!current || (Number(fluid.level) || 1) > (Number(current.level) || 1)) {
			fluidCells.set(coordinate, fluid);
		}
	}

	const groups = new Map();
	for(const fluid of fluidCells.values()) {
		const name = String(fluid?.name || "");
		const x = Number(fluid.x) || 0;
		const y = Number(fluid.y) || 0;
		const z = Number(fluid.z) || 0;
		if(fluidCells.has(`${x}:${y + 1}:${z}`)) {
			continue;
		}

		const definition = getBlockDef(name);
		if(!definition) {
			continue;
		}

		const maxLevel = Math.max(1, Number(definition.maxFluidLevel) || 8);
		const level = Math.max(1, Number(fluid.level) || 1);
		const key = `${name}:${level}`;
		const group = groups.get(key) || { definition, level, maxLevel, fluids: [] };
		group.fluids.push(fluid);
		groups.set(key, group);
	}

	for(const { definition, level, maxLevel, fluids: cells } of groups.values()) {
		const height = Math.max(0.05, Math.min(1, level / maxLevel));
		const geometry = new THREE.PlaneGeometry(1, 1);
		geometry.rotateX(-Math.PI / 2);
		const material = getMaterials(definition)[2];
		if(!material.map) {
			material.color.setHex(0x3a7bd5);
		}

		material.transparent = true;
		material.opacity = 0.55;
		material.depthWrite = false;
		material.polygonOffset = true;
		material.polygonOffsetFactor = -1;
		material.polygonOffsetUnits = -1;
		material.side = THREE.DoubleSide;
		const mesh = new THREE.InstancedMesh(geometry, material, cells.length);
		const matrix = new THREE.Matrix4();
		for(let index = 0; index < cells.length; index += 1) {
			const cell = cells[index];
			matrix.makeTranslation(
				(Number(cell.x) || 0) + 0.5,
				(Number(cell.y) || 0) + height + 0.002,
				(Number(cell.z) || 0) + 0.5,
			);
			mesh.setMatrixAt(index, matrix);
		}

		mesh.instanceMatrix.setUsage(THREE.StaticDrawUsage);
		mesh.instanceMatrix.needsUpdate = true;
		mesh.renderOrder = 10;
		mesh.userData.prefabOwned = true;
		root.add(mesh);
		resources.push(mesh);
	}
};

export async function buildOptimizedPrefabMesh(prefab, options) {
	const { getMaterials, onProgress = () => {}, onRoot = () => {}, isCancelled = () => false } = options;
	const root = new THREE.Group();
	onRoot(root);
	const resources = [];
	const groups = new Map();
	const blocks = Array.isArray(prefab?.blocks) ? prefab.blocks : [];

	for(let index = 0; index < blocks.length; index += 1) {
		if(isCancelled()) {
			return null;
		}

		const block = blocks[index];
		if(isRenderableBlock(block)) {
			const name = String(block.name || "");
			const group = groups.get(name) || [];
			group.push(block);
			groups.set(name, group);
		}

		if(index % 8_000 === 0) {
			await new Promise((resolve) => window.setTimeout(resolve, 0));
		}
	}

	const resolvedGroups = [...groups].map(([name, group]) => {
		const definition = getBlockDef(name);
		const modelPath = definition?.customModel || definition?.itemModel || null;
		const texture = resolveModelTexturePath(definition?.customModel ? definition.customModelTexture : definition?.itemTexture);
		return {
			name,
			group,
			definition,
			loadModel: modelPath ? () => loadBlockyModel(modelPath, texture, getModelTint(definition, name)) : null,
		};
	});
	const cubeGroups = resolvedGroups.filter(({ loadModel }) => !loadModel);
	const modelGroups = resolvedGroups.filter(({ loadModel }) => loadModel);
	const totalRenderableBlocks = resolvedGroups.reduce((total, { group }) => total + group.length, 0);
	let rendered = 0;
	for(const { group, definition } of cubeGroups) {
		if(isCancelled()) {
			return null;
		}

		addCubeInstances(root, group, getMaterials(definition), resources);
		rendered += group.length;
	}
	onProgress(rendered, totalRenderableBlocks);
	addFluidInstances(root, Array.isArray(prefab?.fluids) ? prefab.fluids : [], getMaterials, resources);

	let nextModelIndex = 0;
	const loadModelWorker = async () => {
		while(nextModelIndex < modelGroups.length && !isCancelled()) {
			const modelIndex = nextModelIndex;
			nextModelIndex += 1;
			const current = modelGroups[modelIndex];
			const model = await current.loadModel();
			if(isCancelled()) {
				return;
			}

			if(model) {
				const preparedModel = model.clone(true);
				applyTrapdoorPose(preparedModel, current.name);
				addModelInstances(root, current.group, preparedModel, resources);
			} else {
				addCubeInstances(root, current.group, getMaterials(current.definition), resources);
			}

			rendered += current.group.length;
			onProgress(rendered, totalRenderableBlocks);
			await new Promise((resolve) => window.setTimeout(resolve, 0));
		}
	};
	
	await Promise.all(Array.from({ length: Math.min(MODEL_LOAD_CONCURRENCY, modelGroups.length) }, () => loadModelWorker()));
	const entities = Array.isArray(prefab?.entities) ? prefab.entities : [];
	if(entities.length && !isCancelled()) {
		const entityMesh = await buildPrefabMesh({ blocks: [], fluids: [], entities });
		root.add(entityMesh.root);
	}

	return { root, resources };
}