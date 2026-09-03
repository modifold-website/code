"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import axios from "axios";
import Modal from "react-modal";
import { toast } from "react-toastify";
import { useTranslations } from "next-intl";
import UserName from "@/components/ui/UserName";

const FOLLOW_LIST_LIMIT = 15;
const followListCache = new Map();

const createFollowListState = () => ({
    users: [],
    offset: 0,
    hasMore: true,
    loaded: false,
    isInitialLoading: false,
    isLoadingMore: false,
    loadFailed: false,
});

const getCacheKey = (username, type) => `${username}:${type || "subscribers"}`;

Modal.setAppElement("body");

export default function ProfileSubscriptionsModal({ isOpen, onRequestClose, username, type }) {
    const t = useTranslations("ProfilePage");
    const scrollContainerRef = useRef(null);
    const sentinelRef = useRef(null);
    const requestLockRef = useRef(false);

    const modalType = type === "subscriptions" ? "subscriptions" : "subscribers";
    const cacheKey = useMemo(() => getCacheKey(username, modalType), [username, modalType]);
    const [state, setState] = useState(() => followListCache.get(cacheKey) || createFollowListState());

    useEffect(() => {
        setState(followListCache.get(cacheKey) || createFollowListState());
        requestLockRef.current = false;
    }, [cacheKey]);

    const loadMore = async () => {
        const currentState = followListCache.get(cacheKey) || state;

        if(!username || requestLockRef.current || currentState.isInitialLoading || currentState.isLoadingMore || !currentState.hasMore || currentState.loadFailed) {
            return;
        }

        requestLockRef.current = true;

        setState((prev) => {
            const next = {
                ...prev,
                ...(prev.loaded ? { isLoadingMore: true } : { isInitialLoading: true }),
                loadFailed: false,
            };

            followListCache.set(cacheKey, next);
            return next;
        });

        try {
            const res = await axios.get(`${process.env.NEXT_PUBLIC_API_BASE}/users/${username}/follows`, {
                params: {
                    type: modalType,
                    limit: FOLLOW_LIST_LIMIT,
                    offset: currentState.offset,
                },
            });

            const newUsers = Array.isArray(res.data?.users) ? res.data.users : [];
            const pagination = res.data?.pagination || {};

            setState((prev) => {
                const existingIds = new Set(prev.users.map((item) => item.id));
                const mergedUsers = [...prev.users];

                for(const item of newUsers) {
                    if(!existingIds.has(item.id)) {
                        mergedUsers.push(item);
                        existingIds.add(item.id);
                    }
                }

                const next = {
                    ...prev,
                    users: mergedUsers,
                    offset: typeof pagination.nextOffset === "number" ? pagination.nextOffset : prev.offset + newUsers.length,
                    hasMore: Boolean(pagination.hasMore),
                    loaded: true,
                    isInitialLoading: false,
                    isLoadingMore: false,
                    loadFailed: false,
                };

                followListCache.set(cacheKey, next);
                return next;
            });
        } catch (err) {
            setState((prev) => {
                const next = {
                    ...prev,
                    isInitialLoading: false,
                    isLoadingMore: false,
                    loadFailed: true,
                };
                
                followListCache.set(cacheKey, next);
                return next;
            });
            
            toast.error(t("errors.loadingFollowList"));
        } finally {
            requestLockRef.current = false;
        }
    };

    useEffect(() => {
        if(isOpen && username && !state.loaded && state.hasMore && !state.isInitialLoading && !state.isLoadingMore && !state.loadFailed) {
            loadMore();
        }
    }, [isOpen, username, state.loaded, state.hasMore, state.isInitialLoading, state.isLoadingMore, state.loadFailed, cacheKey]);

    useEffect(() => {
        if(isOpen) {
            return;
        }

        requestLockRef.current = false;

        setState((prev) => {
            if(!prev.loadFailed && !prev.isInitialLoading && !prev.isLoadingMore) {
                return prev;
            }

            const next = {
                ...prev,
                isInitialLoading: false,
                isLoadingMore: false,
                loadFailed: false,
            };

            followListCache.set(cacheKey, next);
            return next;
        });
    }, [isOpen, cacheKey]);

    useEffect(() => {
        if(!isOpen || !state.hasMore || state.isInitialLoading || state.isLoadingMore || state.loadFailed) {
            return;
        }

        const root = scrollContainerRef.current;
        const target = sentinelRef.current;
        if(!root || !target) {
            return;
        }

        const observer = new IntersectionObserver(
            (entries) => {
                const entry = entries[0];
                if(entry?.isIntersecting) {
                    loadMore();
                }
            },
            {
                root,
                rootMargin: "0px 0px 180px 0px",
                threshold: 0.1,
            }
        );

        observer.observe(target);
        return () => observer.disconnect();
    }, [isOpen, state.hasMore, state.isInitialLoading, state.isLoadingMore, state.loadFailed, state.users.length, cacheKey]);

    const title = modalType === "subscriptions" ? t("followersModal.subscriptionsTitle") : t("followersModal.subscribersTitle");

    return (
        <Modal closeTimeoutMS={150} isOpen={isOpen} onRequestClose={onRequestClose} className="modal active" overlayClassName="modal-overlay">
            <div className="modal-window">
                <div className="modal-window__header">
                    <div className="modal-window__title">{title}</div>

                    <button className="icon-button modal-window__close" type="button" onClick={onRequestClose} aria-label={t("close")}>
                        <svg className="icon icon--cross" height="24" width="24">
                            <path fillRule="evenodd" clipRule="evenodd" d="M5.293 5.293a1 1 0 0 1 1.414 0L12 10.586l5.293-5.293a1 1 0 0 1 1.414 1.414L13.414 12l5.293 5.293a1 1 0 0 1-1.414 1.414L12 13.414l-5.293 5.293a1 1 0 0 1-1.414-1.414L10.586 12 5.293 6.707a1 1 0 0 1 0-1.414Z" />
                        </svg>
                    </button>
                </div>

                <div ref={scrollContainerRef} className="scrollable modal-window__content">
                    <div className="subsite-list will-be-animated">
                        <div className="infinite-list">
                            {state.users.map((item) => (
                                <Link key={item.id} className="subsite-list__item" href={`/user/${item.slug}`}>
                                    <div className="andropov-media andropov-media--rounded andropov-media--bordered andropov-media--has-preview andropov-image" style={{ aspectRatio: "1 / 1", width: "36px", height: "36px", maxWidth: "none" }}>
                                        <picture>
                                            <img src={item.avatar || "https://cdn.modifold.com/default_avatar.png"} alt="" loading="lazy" />
                                        </picture>
                                    </div>

                                    <div className="subsite-list__name">
                                        <UserName user={item} />
                                    </div>
                                </Link>
                            ))}

                            {state.isInitialLoading && (
                                <div className="profile-followers-modal__state">
                                    {t("followersModal.loading")}
                                </div>
                            )}

                            {!state.isInitialLoading && state.users.length === 0 && (
                                <div className="profile-followers-modal__state">
                                    {t("followersModal.empty")}
                                </div>
                            )}

                            {!state.isInitialLoading && state.users.length > 0 && state.isLoadingMore && (
                                <div className="profile-followers-modal__state profile-followers-modal__state--loading-more">
                                    {t("followersModal.loadingMore")}
                                </div>
                            )}

                            <div ref={sentinelRef} className="profile-followers-modal__sentinel" aria-hidden="true" />
                        </div>
                    </div>
                </div>
            </div>
        </Modal>
    );
}