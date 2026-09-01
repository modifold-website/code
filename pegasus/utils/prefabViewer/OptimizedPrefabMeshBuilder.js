import * as THREE from "three";
import { buildPrefabMesh, rotationTupleToQuaternion } from "./PrefabMeshBuilder.js";
import { getBlockDef, resolveModelTint } from "./BlockCatalog.js";
import { loadBlockyModel } from "./BlockyModelLoader.js";

const CUBE_GEOMETRY = new THREE.BoxGeometry(1, 1, 1);
// one separate bit lets us combine visible sides in one number
const FACE_EAST = 1 << 0;
const FACE_WEST = 1 << 1;
const FACE_UP = 1 << 2;
const FACE_DOWN = 1 << 3;
const FACE_SOUTH = 1 << 4;
const FACE_NORTH = 1 << 5;
// all six bits mean every cube side is visible
const FULL_CUBE_FACE_MASK = FACE_EAST | FACE_WEST | FACE_UP | FACE_DOWN | FACE_SOUTH | FACE_NORTH;
const CUBE_FACES = [
	{ bit: FACE_EAST, x: 1, y: 0, z: 0 },
	{ bit: FACE_WEST, x: -1, y: 0, z: 0 },
	{ bit: FACE_UP, x: 0, y: 1, z: 0 },
	{ bit: FACE_DOWN, x: 0, y: -1, z: 0 },
	{ bit: FACE_SOUTH, x: 0, y: 0, z: 1 },
	{ bit: FACE_NORTH, x: 0, y: 0, z: -1 },
];
// reuse one small geometry for each visible side
const CUBE_FACE_GEOMETRIES = CUBE_GEOMETRY.groups.map((group) => {
	const geometry = CUBE_GEOMETRY.clone();
	geometry.clearGroups();
	geometry.setDrawRange(group.start, group.count);
	return geometry;
});
const CUBE_FACE_OFFSETS_BY_ROTATION = new Map([[0, CUBE_FACES]]);
// neighbor masks for connected walls
const WALL_CONNECTIONS = [
	{ bit: FACE_EAST, x: 1, z: 0 },
	{ bit: FACE_WEST, x: -1, z: 0 },
	{ bit: FACE_SOUTH, x: 0, z: 1 },
	{ bit: FACE_NORTH, x: 0, z: -1 },
];
// each mask maps a neighbor shape to zero through three quarter turns
const WALL_CORNER_ROTATIONS = new Map([
	[FACE_WEST | FACE_SOUTH, 0],
	[FACE_EAST | FACE_SOUTH, 1],
	[FACE_EAST | FACE_NORTH, 2],
	[FACE_WEST | FACE_NORTH, 3],
]);
const WALL_T_ROTATIONS = new Map([
	[FACE_EAST | FACE_WEST | FACE_SOUTH, 0],
	[FACE_EAST | FACE_SOUTH | FACE_NORTH, 1],
	[FACE_EAST | FACE_WEST | FACE_NORTH, 2],
	[FACE_WEST | FACE_SOUTH | FACE_NORTH, 3],
]);
const TRANSITION_GEOMETRY = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
const IDENTITY_SCALE = new THREE.Vector3(1, 1, 1);
const MODEL_OFFSET = new THREE.Matrix4().makeTranslation(0, -0.5, 0);
const MODEL_LOAD_CONCURRENCY = 10;
// remember parsed connection families
const CONNECTED_PATTERN_ROOTS = new WeakMap();

const isRenderableBlock = (block) => {
	const name = String(block?.name || "").replace(/^\*/, "");
	return Boolean(name && name !== "Empty" && Number(block?.filler || 0) === 0);
};

const blockCellKey = (block, offsetX = 0, offsetY = 0, offsetZ = 0) => {
	const x = Number(block?.x);
	const y = Number(block?.y);
	const z = Number(block?.z);
	if(!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) {
		return null;
	}

	return `${x + offsetX}:${y + offsetY}:${z + offsetZ}`;
};

// turn a prefab state back into its base block name
const rootBlockName = (name) => String(name || "").replace(/^\*/, "").replace(/_State_Definitions_.+$/, "").replace(/_State_.+$/, "");

const getConnectedPatternRoots = (definition) => {
	const cached = CONNECTED_PATTERN_ROOTS.get(definition);
	if(cached) {
		return cached;
	}

	const roots = new Set();
	for(const blocks of Object.values(definition?.connectedBlockRuleSet?.patterns || {})) {
		for(const block of blocks) {
			roots.add(rootBlockName(block));
		}
	}

	CONNECTED_PATTERN_ROOTS.set(definition, roots);

	return roots;
};

const isConnectedNeighbor = (definition, cell) => {
	if(!cell?.block || !cell.definition) {
		return false;
	}

	return getConnectedPatternRoots(definition).has(rootBlockName(cell.block.name));
};

const withConnectedPattern = (block, rule, pattern, yaw = null) => {
	const connectedName = rule.patterns?.[pattern]?.[0];
	if(!connectedName) {
		return block;
	}

	if(yaw == null) {
		return connectedName !== block.name ? { ...block, name: connectedName } : block;
	}

	const rotation = Number(block?.rotation) || 0;
	const connectedRotation = rotation - rotation % 4 + yaw;
	return connectedName !== block.name || connectedRotation !== rotation ? { ...block, name: connectedName, rotation: connectedRotation } : block;
};

// switch village walls between bottom middle and top
const resolveVillageConnection = (block, definition, rule, blockCells) => {
	const hasAbove = isConnectedNeighbor(definition, blockCells.get(blockCellKey(block, 0, 1, 0)));
	const hasBelow = isConnectedNeighbor(definition, blockCells.get(blockCellKey(block, 0, -1, 0)));
	const pattern = hasAbove ? (hasBelow ? "Middle" : "Base") : (hasBelow ? "Base_Inverted" : "Full");
	return withConnectedPattern(block, rule, pattern);
};

// pick straight corner t or cross from nearby walls
const resolveWallConnection = (block, definition, rule, blockCells) => {
	let connections = 0;
	for(const direction of WALL_CONNECTIONS) {
		if(isConnectedNeighbor(definition, blockCells.get(blockCellKey(block, direction.x, 0, direction.z)))) {
			connections |= direction.bit;
		}
	}

	const connectionCount = WALL_CONNECTIONS.reduce((count, direction) => count + ((connections & direction.bit) ? 1 : 0), 0);
	if(connectionCount === 0) {
		return block;
	}

	const eastWest = FACE_EAST | FACE_WEST;
	const northSouth = FACE_NORTH | FACE_SOUTH;
	if(connectionCount === 1 || connections === eastWest || connections === northSouth) {
		const axisYaw = connections & eastWest ? 0 : 1;
		const currentYaw = (Number(block?.rotation) || 0) % 4;
		return withConnectedPattern(block, rule, "Straight", currentYaw % 2 === axisYaw ? currentYaw : axisYaw);
	}

	if(connectionCount === 2) {
		return withConnectedPattern(block, rule, "Corner", WALL_CORNER_ROTATIONS.get(connections));
	}

	if(connectionCount === 3) {
		return withConnectedPattern(block, rule, "T_Junction", WALL_T_ROTATIONS.get(connections));
	}

	return withConnectedPattern(block, rule, "Cross_Junction");
};

// keep explicit prefab states and fill in the missing ones
const resolveConnectedBlock = (block, blockCells) => {
	const name = String(block?.name || "");
	if(name.startsWith("*") && /_State_Definitions_|_State_/.test(name)) {
		return block;
	}

	const definition = getBlockDef(name);
	const rule = definition?.connectedBlockRuleSet;
	if(rule?.type !== "CustomTemplate") {
		return block;
	}

	if(rule.template === "VillageConnectedBlockTemplate") {
		return resolveVillageConnection(block, definition, rule, blockCells);
	}

	if(rule.template === "WallConnectedBlockTemplate") {
		return resolveWallConnection(block, definition, rule, blockCells);
	}

	return block;
};

// only solid full cubes can safely hide faces
const isOpaqueFullCube = (definition) => {
	if(!definition || definition.customModel || definition.itemModel || definition.drawType !== "Cube") {
		return false;
	}

	return definition.opacity == null || definition.opacity === "Solid";
};

// rotate face checks together with the block
const getCubeFaceOffsets = (rotation) => {
	const rotationValue = Number(rotation) || 0;
	const cached = CUBE_FACE_OFFSETS_BY_ROTATION.get(rotationValue);
	if(cached) {
		return cached;
	}

	const quaternion = rotationTupleToQuaternion(rotationValue);
	const offsets = CUBE_FACES.map((face) => {
		const direction = new THREE.Vector3(face.x, face.y, face.z).applyQuaternion(quaternion);
		return {
			bit: face.bit,
			x: Math.round(direction.x),
			y: Math.round(direction.y),
			z: Math.round(direction.z),
		};
	});
	CUBE_FACE_OFFSETS_BY_ROTATION.set(rotationValue, offsets);

	return offsets;
};

// keep only the sides that can actually be seen
const getVisibleFaceMask = (block, definition, opaqueCubeCells) => {
	if(!isOpaqueFullCube(definition)) {
		return FULL_CUBE_FACE_MASK;
	}

	let faceMask = 0;
	for(const face of getCubeFaceOffsets(block?.rotation)) {
		const neighborKey = blockCellKey(block, face.x, face.y, face.z);
		if(!neighborKey || !opaqueCubeCells.has(neighborKey)) {
			faceMask |= face.bit;
		}
	}

	return faceMask;
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

const blockHash = (block, salt = 0) => {
	let hash = 2166136261 ^ salt;
	for(const value of [block?.x, block?.y, block?.z]) {
		hash ^= Number(value) | 0;
		hash = Math.imul(hash, 16777619);
	}
	
	return hash >>> 0;
};

const pickWeightedVariant = (variants, block, salt) => {
	if(!Array.isArray(variants) || variants.length < 2) {
		return 0;
	}

	const totalWeight = variants.reduce((total, variant) => total + Math.max(1, Number(variant?.weight) || 1), 0);
	let selectedWeight = blockHash(block, salt) / 0x100000000 * totalWeight;
	for(let index = 0; index < variants.length; index += 1) {
		selectedWeight -= Math.max(1, Number(variants[index]?.weight) || 1);
		if(selectedWeight < 0) {
			return index;
		}
	}

	return variants.length - 1;
};

const splitVariants = (blocks, variants, salt) => {
	if(!Array.isArray(variants) || variants.length < 2) {
		return [{ variant: variants?.[0] || null, blocks }];
	}

	const groups = variants.map((variant) => ({ variant, blocks: [] }));
	for(const block of blocks) {
		groups[pickWeightedVariant(variants, block, salt)].blocks.push(block);
	}

	return groups.filter((group) => group.blocks.length);
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
	if(!blocks.length) {
		return;
	}

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

// batch visible sides without drawing the hidden ones
const addCulledCubeInstances = (root, blocks, definition, materials, opaqueCubeCells, resources) => {
	if(!isOpaqueFullCube(definition)) {
		addCubeInstances(root, blocks, materials, resources);
		return;
	}

	const faceBlocks = CUBE_FACES.map(() => []);
	let hasHiddenFaces = false;
	for(const block of blocks) {
		const faceMask = getVisibleFaceMask(block, definition, opaqueCubeCells);
		hasHiddenFaces ||= faceMask !== FULL_CUBE_FACE_MASK;
		for(let faceIndex = 0; faceIndex < CUBE_FACES.length; faceIndex += 1) {
			if(faceMask & CUBE_FACES[faceIndex].bit) {
				faceBlocks[faceIndex].push(block);
			}
		}
	}

	if(!hasHiddenFaces) {
		addCubeInstances(root, blocks, materials, resources);
		return;
	}

	const matrix = new THREE.Matrix4();
	for(let faceIndex = 0; faceIndex < faceBlocks.length; faceIndex += 1) {
		const visibleBlocks = faceBlocks[faceIndex];
		if(!visibleBlocks.length) {
			continue;
		}

		const mesh = new THREE.InstancedMesh(CUBE_FACE_GEOMETRIES[faceIndex], materials[faceIndex], visibleBlocks.length);
		for(let index = 0; index < visibleBlocks.length; index += 1) {
			mesh.setMatrixAt(index, getBlockMatrix(visibleBlocks[index], matrix));
		}

		mesh.instanceMatrix.setUsage(THREE.StaticDrawUsage);
		mesh.instanceMatrix.needsUpdate = true;
		mesh.castShadow = true;
		mesh.receiveShadow = true;
		root.add(mesh);
		resources.push(mesh);
	}
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

// match simple tags like fluid=water
const hasDefinitionTag = (definition, expression) => {
	const separator = String(expression || "").indexOf("=");
	if(separator < 1) {
		return false;
	}

	const category = expression.slice(0, separator);
	const value = expression.slice(separator + 1);
	return definition?.tags?.[category]?.includes(value) || false;
};

const matchesTransitionTarget = (source, target) => {
	const groupMatch = target?.group && source?.transitionToGroups?.includes(target.group);
	return Boolean(groupMatch || hasDefinitionTag(target, source?.transitionToTag));
};

const getFluidHeight = (definition, fluid) => {
	const maxLevel = Math.max(1, Number(definition?.maxFluidLevel) || 8);
	const level = Math.max(1, Number(fluid?.level) || 1);
	return Math.max(0.05, Math.min(1, level / maxLevel));
};

// keep the strongest fluid entry in each cell
const createFluidCells = (fluids) => {
	const fluidCells = new Map();
	for(const fluid of fluids) {
		const name = String(fluid?.name || "");
		const coordinate = blockCellKey(fluid);
		if(!name || name === "Empty" || !coordinate) {
			continue;
		}

		const current = fluidCells.get(coordinate);
		if(!current || (Number(fluid.level) || 1) > (Number(current.fluid.level) || 1)) {
			fluidCells.set(coordinate, { fluid, definition: getBlockDef(name) });
		}
	}

	return fluidCells;
};

// place transition strips on matching block or fluid tops
const addTransitionInstances = (root, blockCells, fluidCells, getTransitionMaterial, resources) => {
	if(typeof getTransitionMaterial !== "function") {
		return;
	}

	const directions = [
		{ x: 0, z: -1, rotation: 0 },
		{ x: 1, z: 0, rotation: Math.PI / 2 },
		{ x: 0, z: 1, rotation: Math.PI },
		{ x: -1, z: 0, rotation: -Math.PI / 2 },
	];

	const groups = new Map();
	for(const { block, definition } of blockCells.values()) {
		if(!definition?.transitionTexture || (!definition.transitionToGroups?.length && !definition.transitionToTag) || definition.customModel) {
			continue;
		}

		const x = Number(block.x) || 0;
		const y = Number(block.y) || 0;
		const z = Number(block.z) || 0;
		if(blockCells.has(`${x}:${y + 1}:${z}`)) {
			continue;
		}

		for(let directionIndex = 0; directionIndex < directions.length; directionIndex += 1) {
			const direction = directions[directionIndex];
			const targetX = x + direction.x;
			const targetZ = z + direction.z;
			const targetKey = `${targetX}:${y}:${targetZ}`;
			const blockTarget = blockCells.get(targetKey);
			const fluidTarget = fluidCells.get(targetKey);
			let surfaceY = null;
			if(blockTarget && !blockTarget.definition?.customModel && !blockCells.has(`${targetX}:${y + 1}:${targetZ}`) && matchesTransitionTarget(definition, blockTarget.definition)) {
				surfaceY = y + 1.002;
			} else if(fluidTarget?.definition && !fluidCells.has(`${targetX}:${y + 1}:${targetZ}`) && matchesTransitionTarget(definition, fluidTarget.definition)) {
				surfaceY = y + getFluidHeight(fluidTarget.definition, fluidTarget.fluid) + 0.002;
			}
			if(surfaceY == null) {
				continue;
			}

			const key = `${block.name}:${directionIndex}`;
			const group = groups.get(key) || { definition, direction, targets: [] };
			group.targets.push({ x: targetX, y: surfaceY, z: targetZ, directionIndex });
			groups.set(key, group);
		}
	}

	for(const { definition, direction, targets } of groups.values()) {
		const mesh = new THREE.InstancedMesh(TRANSITION_GEOMETRY, getTransitionMaterial(definition), targets.length);
		const matrix = new THREE.Matrix4();
		for(let index = 0; index < targets.length; index += 1) {
			const target = targets[index];
			matrix.makeRotationY(direction.rotation);
			matrix.setPosition(target.x + 0.5, target.y + target.directionIndex * 0.0002, target.z + 0.5);
			mesh.setMatrixAt(index, matrix);
		}

		mesh.instanceMatrix.setUsage(THREE.StaticDrawUsage);
		mesh.instanceMatrix.needsUpdate = true;
		mesh.receiveShadow = true;
		mesh.renderOrder = 3;
		root.add(mesh);
		resources.push(mesh);
	}
};

const addFluidInstances = (root, fluidCells, getMaterials, resources) => {
	const groups = new Map();
	for(const { fluid, definition } of fluidCells.values()) {
		const name = String(fluid?.name || "");
		const x = Number(fluid.x) || 0;
		const y = Number(fluid.y) || 0;
		const z = Number(fluid.z) || 0;
		if(fluidCells.has(`${x}:${y + 1}:${z}`)) {
			continue;
		}

		if(!definition) {
			continue;
		}

		const level = Math.max(1, Number(fluid.level) || 1);
		const key = `${name}:${level}`;
		const group = groups.get(key) || { definition, level, fluids: [] };
		group.fluids.push(fluid);
		groups.set(key, group);
	}

	for(const { definition, level, fluids: cells } of groups.values()) {
		const height = getFluidHeight(definition, { level });
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
	const { getMaterials, getTransitionMaterial, onProgress = () => {}, onRoot = () => {}, isCancelled = () => false } = options;
	const root = new THREE.Group();
	onRoot(root);
	const resources = [];
	const groups = new Map();
	const definitions = new Map();
	const blocks = Array.isArray(prefab?.blocks) ? prefab.blocks : [];
	const blockCells = new Map();
	const fluids = Array.isArray(prefab?.fluids) ? prefab.fluids : [];
	const fluidCells = createFluidCells(fluids);

	// index neighbors once for connections and hidden faces
	for(let index = 0; index < blocks.length; index += 1) {
		if(isCancelled()) {
			return null;
		}

		const block = blocks[index];
		if(isRenderableBlock(block)) {
			const key = blockCellKey(block);
			if(key) {
				blockCells.set(key, { block, definition: getBlockDef(block.name) });
			}
		}

		if(index % 8_000 === 0) {
			await new Promise((resolve) => window.setTimeout(resolve, 0));
		}
	}

	// resolve connected shapes before grouping the blocks
	for(let index = 0; index < blocks.length; index += 1) {
		if(isCancelled()) {
			return null;
		}

		const block = blocks[index];
		if(isRenderableBlock(block)) {
			const connectedBlock = resolveConnectedBlock(block, blockCells);
			const name = String(connectedBlock.name || "");
			const group = groups.get(name) || [];
			group.push(connectedBlock);
			groups.set(name, group);
		}

		if(index % 8_000 === 0) {
			await new Promise((resolve) => window.setTimeout(resolve, 0));
		}
	}

	const cubeGroups = [];
	const modelGroups = [];
	for(const [name, group] of groups) {
		const definition = getBlockDef(name);
		definitions.set(name, definition);
		const modelPath = definition?.customModel || definition?.itemModel || null;
		if(modelPath) {
			const textureVariants = definition?.customModelTextureVariants;
			for(const variantGroup of splitVariants(group, textureVariants, 0x6d2b79f5)) {
				const texture = variantGroup.variant?.texture || resolveModelTexturePath(definition?.customModel ? definition.customModelTexture : definition?.itemTexture);
				modelGroups.push({
					name,
					group: variantGroup.blocks,
					definition,
					loadModel: () => loadBlockyModel(modelPath, texture, resolveModelTint(definition)),
				});
			}

			continue;
		}

		for(const variantGroup of splitVariants(group, definition?.textureVariants, 0x9e3779b9)) {
			cubeGroups.push({
				group: variantGroup.blocks,
				definition: variantGroup.variant ? { ...definition, textures: variantGroup.variant.textures } : definition,
			});
		}
	}

	const opaqueCubeCells = new Set();
	for(const [name, group] of groups) {
		if(!isOpaqueFullCube(definitions.get(name))) {
			continue;
		}

		for(const block of group) {
			const key = blockCellKey(block);
			if(key) {
				opaqueCubeCells.add(key);
			}
		}
	}

	const totalRenderableBlocks = [...groups.values()].reduce((total, group) => total + group.length, 0);
	let rendered = 0;
	for(const { group, definition } of cubeGroups) {
		if(isCancelled()) {
			return null;
		}

		const materials = getMaterials(definition);
		addCulledCubeInstances(root, group, definition, materials, opaqueCubeCells, resources);
		rendered += group.length;
	}

	onProgress(rendered, totalRenderableBlocks);
	addTransitionInstances(root, blockCells, fluidCells, getTransitionMaterial, resources);
	addFluidInstances(root, fluidCells, getMaterials, resources);

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