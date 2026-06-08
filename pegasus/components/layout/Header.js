"use client";

import { useState, useEffect, useRef } from "react";
import { useAuth } from "../providers/AuthProvider";
import LoginModal from "../../modal/LoginModal";
import ProjectCreationModal from "../../modal/ProjectCreationModal";
import Link from "next/link";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { toast } from "react-toastify";

export default function Header({ authToken }) {
    const t = useTranslations("Header");
    const { isLoggedIn, user, logout } = useAuth();
    const [loginModalOpen, setLoginModalOpen] = useState(false);
    const [projectModalOpen, setProjectModalOpen] = useState(false);
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const [isBrowseMenuOpen, setIsBrowseMenuOpen] = useState(false);
    const [unreadCount, setUnreadCount] = useState(0);
    const menuRef = useRef(null);
    const buttonRef = useRef(null);
    const browseWrapperRef = useRef(null);
    const browseCloseTimeoutRef = useRef(null);


    useEffect(() => {
        return () => {
            if(browseCloseTimeoutRef.current) {
                clearTimeout(browseCloseTimeoutRef.current);
                browseCloseTimeoutRef.current = null;
            }
        };
    }, []);

    useEffect(() => {
        if(!isLoggedIn) {
            setUnreadCount(0);
            return;
        }

        let isMounted = true;
        let intervalId = null;
        const getToken = () => authToken || localStorage.getItem("authToken");

        const fetchUnreadCount = async () => {
            const token = getToken();
            if(!token) {
                return;
            }

            try {
                const response = await fetch(`${process.env.NEXT_PUBLIC_API_BASE}/notifications/unread-count`, {
                    headers: {
                        Authorization: `Bearer ${token}`,
                        Accept: "application/json",
                    },
                });

                if(!response.ok) {
                    return;
                }

                const data = await response.json();
                if(isMounted) {
                    setUnreadCount(Number(data?.unreadCount || 0));
                }
            } catch (error) {
                console.error("Error fetching unread notifications count:", error);
            }
        };

        const handleUnreadUpdate = (event) => {
            const nextCount = Number(event?.detail?.unreadCount);
            if(Number.isFinite(nextCount)) {
                setUnreadCount(Math.max(0, nextCount));
            } else {
                fetchUnreadCount();
            }
        };

        fetchUnreadCount();
        intervalId = setInterval(fetchUnreadCount, 60000);
        window.addEventListener("notifications:updated", handleUnreadUpdate);

        return () => {
            isMounted = false;
            if(intervalId) {
                clearInterval(intervalId);
            }

            window.removeEventListener("notifications:updated", handleUnreadUpdate);
        };
    }, [isLoggedIn, authToken]);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if(isMenuOpen && menuRef.current && !menuRef.current.contains(event.target) && buttonRef.current && !buttonRef.current.contains(event.target)) {
                setIsMenuOpen(false);
            }

            if(isBrowseMenuOpen && browseWrapperRef.current && !browseWrapperRef.current.contains(event.target)) {
                setIsBrowseMenuOpen(false);
            }
        };

        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [isMenuOpen, isBrowseMenuOpen]);

    const openBrowseMenu = () => {
        if(browseCloseTimeoutRef.current) {
            clearTimeout(browseCloseTimeoutRef.current);
            browseCloseTimeoutRef.current = null;
        }

        setIsBrowseMenuOpen(true);
    };

    const scheduleCloseBrowseMenu = () => {
        if(browseCloseTimeoutRef.current) {
            clearTimeout(browseCloseTimeoutRef.current);
        }

        browseCloseTimeoutRef.current = setTimeout(() => {
            setIsBrowseMenuOpen(false);
        }, 150);
    };

    const toggleMenu = () => {
        setIsMenuOpen((prev) => !prev);
    };

    const closeAccountMenu = () => {
        setIsMenuOpen(false);
    };

    const toggleBrowseMenu = () => {
        setIsBrowseMenuOpen((prev) => !prev);
    };

    const openLoginModal = () => {
        setLoginModalOpen(true);
        setProjectModalOpen(false);
    };

    const openProjectModal = () => {
        if(!isLoggedIn) {
            toast.error(t("loginToCreate"));
            openLoginModal();
            return;
        }

        setProjectModalOpen(true);
        setLoginModalOpen(false);
    };

    const closeModals = () => {
        setLoginModalOpen(false);
        setProjectModalOpen(false);
    };

    const isStaging = process.env.NEXT_PUBLIC_API_BASE?.includes("staging");
    const unreadLabel = unreadCount > 99 ? "99+" : String(unreadCount);

    return (
        <>
            <div className="header">
                <div className="header__layout">
                    <div className="header__left">
                        <Link href="/" className="sidebarOpacity" aria-label={t("home")}>
                            {isStaging ? (                          
                                <svg width="140" height="50" viewBox="0 0 250 73" fill="none" xmlns="http://www.w3.org/2000/svg">
                                    <path d="M86.608 54.54C83.44 54.54 80.794 53.802 78.67 52.326C76.582 50.814 75.232 48.744 74.62 46.116L80.614 45.09C81.082 46.422 81.874 47.448 82.99 48.168C84.142 48.888 85.51 49.248 87.094 49.248C88.462 49.248 89.614 48.996 90.55 48.492C91.486 47.988 91.954 47.214 91.954 46.17C91.954 45.198 91.468 44.46 90.496 43.956C89.524 43.416 88.03 42.876 86.014 42.336C83.998 41.76 82.324 41.184 80.992 40.608C79.66 40.032 78.508 39.186 77.536 38.07C76.6 36.954 76.132 35.478 76.132 33.642C76.132 30.978 77.158 28.944 79.21 27.54C81.262 26.1 83.818 25.38 86.878 25.38C89.65 25.38 92.044 26.1 94.06 27.54C96.076 28.944 97.48 30.888 98.272 33.372L92.494 34.344C91.99 33.156 91.252 32.256 90.28 31.644C89.344 30.996 88.228 30.672 86.932 30.672C85.708 30.672 84.664 30.924 83.8 31.428C82.972 31.932 82.558 32.616 82.558 33.48C82.558 34.488 83.062 35.28 84.07 35.856C85.078 36.396 86.626 36.954 88.714 37.53C90.658 38.07 92.278 38.646 93.574 39.258C94.906 39.834 96.022 40.68 96.922 41.796C97.858 42.876 98.326 44.28 98.326 46.008C98.326 47.592 97.894 49.032 97.03 50.328C96.166 51.588 94.852 52.614 93.088 53.406C91.36 54.162 89.2 54.54 86.608 54.54ZM118.025 48.6L117.485 54H112.247C109.187 54 106.865 53.28 105.281 51.84C103.697 50.364 102.905 48.24 102.905 45.468V31.32H98.3146V25.92H102.905L104.471 17.82H109.115V25.92H117.485V31.32H109.115V45.468C109.115 47.556 110.159 48.6 112.247 48.6H118.025ZM131.654 25.38C135.254 25.38 138.08 26.514 140.132 28.782C142.22 31.014 143.264 34.164 143.264 38.232V54H138.674L137.378 49.572C136.586 50.904 135.416 52.074 133.868 53.082C132.32 54.054 130.484 54.54 128.36 54.54C126.488 54.54 124.796 54.162 123.284 53.406C121.808 52.65 120.656 51.588 119.828 50.22C119 48.852 118.586 47.304 118.586 45.576C118.586 42.912 119.63 40.788 121.718 39.204C123.842 37.584 126.92 36.774 130.952 36.774H137C136.856 34.902 136.28 33.426 135.272 32.346C134.3 31.23 132.986 30.672 131.33 30.672C129.998 30.672 128.846 30.996 127.874 31.644C126.902 32.292 126.182 33.084 125.714 34.02L119.99 33.048C120.674 30.672 122.078 28.8 124.202 27.432C126.362 26.064 128.846 25.38 131.654 25.38ZM129.818 49.302C131.978 49.302 133.724 48.6 135.056 47.196C136.388 45.792 137.054 43.938 137.054 41.634H131.168C126.956 41.634 124.85 42.858 124.85 45.306C124.85 46.53 125.3 47.502 126.2 48.222C127.1 48.942 128.306 49.302 129.818 49.302ZM160.099 65.07C156.895 65.07 154.051 64.296 151.567 62.748C149.119 61.236 147.391 59.13 146.383 56.43L152.485 55.404C153.277 56.7 154.321 57.69 155.617 58.374C156.913 59.058 158.425 59.4 160.153 59.4C162.637 59.4 164.689 58.698 166.309 57.294C167.929 55.89 168.739 53.694 168.739 50.706V48.168C167.659 49.572 166.273 50.688 164.581 51.516C162.925 52.308 161.035 52.704 158.911 52.704C156.355 52.704 154.069 52.128 152.053 50.976C150.073 49.788 148.507 48.168 147.355 46.116C146.239 44.028 145.681 41.67 145.681 39.042C145.681 36.414 146.239 34.074 147.355 32.022C148.507 29.934 150.073 28.314 152.053 27.162C154.069 25.974 156.355 25.38 158.911 25.38C161.179 25.38 163.159 25.83 164.851 26.73C166.579 27.594 167.965 28.8 169.009 30.348L170.305 25.92H174.949V50.76C174.949 53.82 174.283 56.43 172.951 58.59C171.619 60.75 169.819 62.37 167.551 63.45C165.319 64.53 162.835 65.07 160.099 65.07ZM160.423 47.142C162.871 47.142 164.869 46.404 166.417 44.928C167.965 43.416 168.739 41.454 168.739 39.042C168.739 36.63 167.965 34.686 166.417 33.21C164.869 31.698 162.871 30.942 160.423 30.942C157.975 30.942 155.977 31.698 154.429 33.21C152.917 34.686 152.161 36.63 152.161 39.042C152.161 41.454 152.917 43.416 154.429 44.928C155.977 46.404 157.975 47.142 160.423 47.142ZM185.727 54H179.517V25.92H185.727V54ZM182.649 21.924C181.497 21.924 180.561 21.582 179.841 20.898C179.121 20.178 178.761 19.26 178.761 18.144C178.761 17.028 179.121 16.11 179.841 15.39C180.597 14.67 181.533 14.31 182.649 14.31C183.765 14.31 184.683 14.67 185.403 15.39C186.123 16.11 186.483 17.028 186.483 18.144C186.483 19.26 186.123 20.178 185.403 20.898C184.683 21.582 183.765 21.924 182.649 21.924ZM190.311 54V25.92H194.955L196.197 30.132C197.097 28.656 198.285 27.504 199.761 26.676C201.273 25.812 202.893 25.38 204.621 25.38C206.637 25.38 208.455 25.884 210.075 26.892C211.695 27.9 212.973 29.286 213.909 31.05C214.845 32.814 215.313 34.812 215.313 37.044V54H209.103V37.746C209.103 35.73 208.527 34.092 207.375 32.832C206.223 31.572 204.747 30.942 202.947 30.942C201.075 30.942 199.527 31.59 198.303 32.886C197.115 34.146 196.521 35.766 196.521 37.746V54H190.311ZM232.155 65.07C228.951 65.07 226.107 64.296 223.623 62.748C221.175 61.236 219.447 59.13 218.439 56.43L224.541 55.404C225.333 56.7 226.377 57.69 227.673 58.374C228.969 59.058 230.481 59.4 232.209 59.4C234.693 59.4 236.745 58.698 238.365 57.294C239.985 55.89 240.795 53.694 240.795 50.706V48.168C239.715 49.572 238.329 50.688 236.637 51.516C234.981 52.308 233.091 52.704 230.967 52.704C228.411 52.704 226.125 52.128 224.109 50.976C222.129 49.788 220.563 48.168 219.411 46.116C218.295 44.028 217.737 41.67 217.737 39.042C217.737 36.414 218.295 34.074 219.411 32.022C220.563 29.934 222.129 28.314 224.109 27.162C226.125 25.974 228.411 25.38 230.967 25.38C233.235 25.38 235.215 25.83 236.907 26.73C238.635 27.594 240.021 28.8 241.065 30.348L242.361 25.92H247.005V50.76C247.005 53.82 246.339 56.43 245.007 58.59C243.675 60.75 241.875 62.37 239.607 63.45C237.375 64.53 234.891 65.07 232.155 65.07ZM232.479 47.142C234.927 47.142 236.925 46.404 238.473 44.928C240.021 43.416 240.795 41.454 240.795 39.042C240.795 36.63 240.021 34.686 238.473 33.21C236.925 31.698 234.927 30.942 232.479 30.942C230.031 30.942 228.033 31.698 226.485 33.21C224.973 34.686 224.217 36.63 224.217 39.042C224.217 41.454 224.973 43.416 226.485 44.928C228.033 46.404 230.031 47.142 232.479 47.142Z" fill="currentColor"/>
                                    <path d="M30.8414 1.17779C31.2484 0.940732 31.7515 0.94074 32.1585 1.17779L62.3522 18.7702C62.7533 19.0039 63 19.4325 63 19.8961V53.2961C63 53.762 62.7509 54.1925 62.3468 54.4253L32.1531 71.8253C31.7489 72.0582 31.251 72.0583 30.8468 71.8253L0.653107 54.4253C0.248963 54.1925 0 53.762 0 53.2961V19.8961C8.9039e-06 19.4325 0.246626 19.0039 0.64771 18.7702L30.8414 1.17779ZM3.48082 21.1032V52.0932L31.5001 68.2903L59.5194 52.0932V21.1032L31.5001 4.70553L3.48082 21.1032ZM56.2998 22.7078V50.5889L31.5001 64.6798L6.70042 50.5889V22.7078L31.5001 8.31602L56.2998 22.7078ZM9.99776 48.9341L30.1938 60.4676V37.7014L9.99776 26.2682V48.9341ZM33.1077 37.7346V60.3673L53.2033 48.9015V26.1679L33.1077 37.7346ZM28.0838 52.7454V56.3729L25.0695 54.651V51.0405L28.0838 52.7454ZM38.1316 54.6509L35.1173 56.3728V52.7453L38.1316 51.0404V54.6509ZM15.2226 45.5245V49.1349L12.1078 47.43V43.8195L15.2226 45.5245ZM51.0933 47.4299L47.9784 49.1348V45.5244L51.0933 43.8194V47.4299ZM22.658 40.3093V47.0288L17.0312 43.9198V37.2003L22.658 40.3093ZM46.1698 43.9197L40.5431 47.0287V40.3092L46.1698 37.2002V43.9197ZM28.1843 39.4067V43.2177L25.0695 41.5128V37.7017L28.1843 39.4067ZM38.1316 41.5127L35.0168 43.2176V39.4066L38.1316 37.7016V41.5127ZM15.2226 32.3863V35.9968L12.1078 34.2918V30.6813L15.2226 32.3863ZM51.0933 34.2917L47.9784 35.9967V32.3862L51.0933 30.6812V34.2917Z" fill="#2041DA"/>
                                </svg>
                            ) : (
                                <svg width="160" height="50" viewBox="0 0 287 73" fill="none" xmlns="http://www.w3.org/2000/svg">
                                    <path d="M76.51 52V23.92H81.154L82.288 27.916C83.044 26.584 84.088 25.504 85.42 24.676C86.752 23.812 88.354 23.38 90.226 23.38C92.098 23.38 93.772 23.83 95.248 24.73C96.724 25.63 97.822 26.872 98.542 28.456C99.226 27.052 100.306 25.864 101.782 24.892C103.294 23.884 105.076 23.38 107.128 23.38C109.072 23.38 110.8 23.884 112.312 24.892C113.86 25.864 115.048 27.232 115.876 28.996C116.74 30.724 117.172 32.704 117.172 34.936V52H110.962V35.53C110.962 33.586 110.458 32.002 109.45 30.778C108.442 29.554 107.128 28.942 105.508 28.942C103.888 28.942 102.556 29.572 101.512 30.832C100.468 32.056 99.946 33.622 99.946 35.53V52H93.736V35.53C93.736 33.586 93.232 32.002 92.224 30.778C91.216 29.554 89.902 28.942 88.282 28.942C86.662 28.942 85.33 29.572 84.286 30.832C83.242 32.056 82.72 33.622 82.72 35.53V52H76.51ZM134.61 52.54C131.73 52.54 129.138 51.928 126.834 50.704C124.566 49.444 122.784 47.716 121.488 45.52C120.228 43.288 119.598 40.768 119.598 37.96C119.598 35.152 120.228 32.65 121.488 30.454C122.784 28.222 124.566 26.494 126.834 25.27C129.138 24.01 131.73 23.38 134.61 23.38C137.49 23.38 140.064 24.01 142.332 25.27C144.636 26.494 146.418 28.222 147.678 30.454C148.974 32.65 149.622 35.152 149.622 37.96C149.622 40.768 148.974 43.288 147.678 45.52C146.418 47.716 144.636 49.444 142.332 50.704C140.064 51.928 137.49 52.54 134.61 52.54ZM134.61 46.87C137.13 46.87 139.182 46.06 140.766 44.44C142.35 42.784 143.142 40.624 143.142 37.96C143.142 35.296 142.35 33.154 140.766 31.534C139.182 29.878 137.13 29.05 134.61 29.05C132.09 29.05 130.038 29.878 128.454 31.534C126.87 33.154 126.078 35.296 126.078 37.96C126.078 40.624 126.87 42.784 128.454 44.44C130.038 46.06 132.09 46.87 134.61 46.87ZM164.417 52.54C161.789 52.54 159.431 51.928 157.343 50.704C155.255 49.444 153.617 47.716 152.429 45.52C151.277 43.288 150.701 40.768 150.701 37.96C150.701 35.152 151.277 32.65 152.429 30.454C153.617 28.222 155.255 26.494 157.343 25.27C159.431 24.01 161.789 23.38 164.417 23.38C166.685 23.38 168.701 23.848 170.465 24.784C172.229 25.684 173.669 26.818 174.785 28.186V13.93H180.995V52H176.351L175.055 47.464C173.903 48.868 172.427 50.074 170.627 51.082C168.827 52.054 166.757 52.54 164.417 52.54ZM165.929 46.978C168.557 46.978 170.681 46.15 172.301 44.494C173.957 42.802 174.785 40.624 174.785 37.96C174.785 35.296 173.957 33.136 172.301 31.48C170.681 29.788 168.557 28.942 165.929 28.942C163.337 28.942 161.231 29.788 159.611 31.48C157.991 33.136 157.181 35.296 157.181 37.96C157.181 40.624 157.991 42.802 159.611 44.494C161.231 46.15 163.337 46.978 165.929 46.978ZM192.066 52H185.856V23.92H192.066V52ZM188.988 19.924C187.836 19.924 186.9 19.582 186.18 18.898C185.46 18.178 185.1 17.26 185.1 16.144C185.1 15.028 185.46 14.11 186.18 13.39C186.936 12.67 187.872 12.31 188.988 12.31C190.104 12.31 191.022 12.67 191.742 13.39C192.462 14.11 192.822 15.028 192.822 16.144C192.822 17.26 192.462 18.178 191.742 18.898C191.022 19.582 190.104 19.924 188.988 19.924ZM204.749 23.92H213.119V29.32H204.749V52H198.539V29.32H193.949V23.92H198.539V22.462C198.539 19.69 199.331 17.584 200.915 16.144C202.535 14.668 204.857 13.93 207.881 13.93H213.119L213.659 19.33H207.881C205.793 19.33 204.749 20.374 204.749 22.462V23.92ZM226.22 52.54C223.34 52.54 220.748 51.928 218.444 50.704C216.176 49.444 214.394 47.716 213.098 45.52C211.838 43.288 211.208 40.768 211.208 37.96C211.208 35.152 211.838 32.65 213.098 30.454C214.394 28.222 216.176 26.494 218.444 25.27C220.748 24.01 223.34 23.38 226.22 23.38C229.1 23.38 231.674 24.01 233.942 25.27C236.246 26.494 238.028 28.222 239.288 30.454C240.584 32.65 241.232 35.152 241.232 37.96C241.232 40.768 240.584 43.288 239.288 45.52C238.028 47.716 236.246 49.444 233.942 50.704C231.674 51.928 229.1 52.54 226.22 52.54ZM226.22 46.87C228.74 46.87 230.792 46.06 232.376 44.44C233.96 42.784 234.752 40.624 234.752 37.96C234.752 35.296 233.96 33.154 232.376 31.534C230.792 29.878 228.74 29.05 226.22 29.05C223.7 29.05 221.648 29.878 220.064 31.534C218.48 33.154 217.688 35.296 217.688 37.96C217.688 40.624 218.48 42.784 220.064 44.44C221.648 46.06 223.7 46.87 226.22 46.87ZM250.411 52H244.201V13.93H250.411V52ZM267.091 52.54C264.463 52.54 262.105 51.928 260.017 50.704C257.929 49.444 256.291 47.716 255.103 45.52C253.951 43.288 253.375 40.768 253.375 37.96C253.375 35.152 253.951 32.65 255.103 30.454C256.291 28.222 257.929 26.494 260.017 25.27C262.105 24.01 264.463 23.38 267.091 23.38C269.359 23.38 271.375 23.848 273.139 24.784C274.903 25.684 276.343 26.818 277.459 28.186V13.93H283.669V52H279.025L277.729 47.464C276.577 48.868 275.101 50.074 273.301 51.082C271.501 52.054 269.431 52.54 267.091 52.54ZM268.603 46.978C271.231 46.978 273.355 46.15 274.975 44.494C276.631 42.802 277.459 40.624 277.459 37.96C277.459 35.296 276.631 33.136 274.975 31.48C273.355 29.788 271.231 28.942 268.603 28.942C266.011 28.942 263.905 29.788 262.285 31.48C260.665 33.136 259.855 35.296 259.855 37.96C259.855 40.624 260.665 42.802 262.285 44.494C263.905 46.15 266.011 46.978 268.603 46.978Z" fill="currentColor" />
                                    <path d="M30.8414 1.17779C31.2484 0.940732 31.7515 0.94074 32.1585 1.17779L62.3522 18.7702C62.7533 19.0039 63 19.4325 63 19.8961V53.2961C63 53.762 62.7509 54.1925 62.3468 54.4253L32.1531 71.8253C31.7489 72.0582 31.251 72.0583 30.8468 71.8253L0.653107 54.4253C0.248963 54.1925 0 53.762 0 53.2961V19.8961C8.9039e-06 19.4325 0.246626 19.0039 0.64771 18.7702L30.8414 1.17779ZM3.48082 21.1032V52.0932L31.5001 68.2903L59.5194 52.0932V21.1032L31.5001 4.70553L3.48082 21.1032ZM56.2998 22.7078V50.5889L31.5001 64.6798L6.70042 50.5889V22.7078L31.5001 8.31602L56.2998 22.7078ZM9.99776 48.9341L30.1938 60.4676V37.7014L9.99776 26.2682V48.9341ZM33.1077 37.7346V60.3673L53.2033 48.9015V26.1679L33.1077 37.7346ZM28.0838 52.7454V56.3729L25.0695 54.651V51.0405L28.0838 52.7454ZM38.1316 54.6509L35.1173 56.3728V52.7453L38.1316 51.0404V54.6509ZM15.2226 45.5245V49.1349L12.1078 47.43V43.8195L15.2226 45.5245ZM51.0933 47.4299L47.9784 49.1348V45.5244L51.0933 43.8194V47.4299ZM22.658 40.3093V47.0288L17.0312 43.9198V37.2003L22.658 40.3093ZM46.1698 43.9197L40.5431 47.0287V40.3092L46.1698 37.2002V43.9197ZM28.1843 39.4067V43.2177L25.0695 41.5128V37.7017L28.1843 39.4067ZM38.1316 41.5127L35.0168 43.2176V39.4066L38.1316 37.7016V41.5127ZM15.2226 32.3863V35.9968L12.1078 34.2918V30.6813L15.2226 32.3863ZM51.0933 34.2917L47.9784 35.9967V32.3862L51.0933 30.6812V34.2917Z" fill="#2041DA" />
                                </svg>
                            )}
                        </Link>
                    </div>

                    <div className="browse-menu-wrapper" ref={browseWrapperRef} onMouseEnter={openBrowseMenu} onMouseLeave={scheduleCloseBrowseMenu}>
                        <button style={{ "--button-font-size": "16px" }} className={`button button--size-m button--type-secondary button__browse--with-icon button--active-transform ${isBrowseMenuOpen ? "active" : ""}`} onClick={toggleBrowseMenu} aria-expanded={isBrowseMenuOpen} aria-controls="browse-menu">
                            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-compass-icon lucide-compass">
                                <path d="m16.24 7.76-1.804 5.411a2 2 0 0 1-1.265 1.265L7.76 16.24l1.804-5.411a2 2 0 0 1 1.265-1.265z"/>
                                <circle cx="12" cy="12" r="10"/>
                            </svg>

                            {t("browse")}

                            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={`lucide lucide-chevron-down-icon ${isBrowseMenuOpen ? "rotate" : ""}`} style={{ fill: "none" }}>
                                <path d="m6 9 6 6 6-6"></path>
                            </svg>
                        </button>

                        <div id="browse-menu" className={`bubble account-menu-root user-menu browse-menu ${isBrowseMenuOpen ? "open" : ""}`} style={{ width: "210px", right: "auto" }}>
                            <div className="account-menu">
                                <div className="account-menu__title" style={{ marginBottom: "6px" }}>{t("discoverContent")}</div>
                                
                                <div className="account-menu__section">
                                    <div className="account-action">
                                        <Link href="/mods" onClick={() => setIsBrowseMenuOpen(false)} className="account-action__wrapper button--active-transform">
                                            <svg style={{ fill: "none", marginRight: "12px" }} className="icon icon--settings account-action__icon" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                <path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"></path>
                                                <path d="m3.3 7 8.7 5 8.7-5"></path>
                                                <path d="M12 22V12"></path>
                                            </svg>
                                            
                                            <span>{t("mods")}</span>
                                        </Link>
                                    </div>

                                    <div className="account-action">
                                        <Link href="/modpacks" onClick={() => setIsBrowseMenuOpen(false)} className="account-action__wrapper button--active-transform">
                                            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="icon lucide lucide-package-open-icon lucide-package-open account-action__icon" style={{ fill: "none", marginRight: "12px" }}>
                                                <path d="M12 22v-9"></path>
                                                <path d="M15.17 2.21a1.67 1.67 0 0 1 1.63 0L21 4.57a1.93 1.93 0 0 1 0 3.36L8.82 14.79a1.655 1.655 0 0 1-1.64 0L3 12.43a1.93 1.93 0 0 1 0-3.36z"></path>
                                                <path d="M20 13v3.87a2.06 2.06 0 0 1-1.11 1.83l-6 3.08a1.93 1.93 0 0 1-1.78 0l-6-3.08A2.06 2.06 0 0 1 4 16.87V13"></path>
                                                <path d="M21 12.43a1.93 1.93 0 0 0 0-3.36L8.83 2.2a1.64 1.64 0 0 0-1.63 0L3 4.57a1.93 1.93 0 0 0 0 3.36l12.18 6.86a1.636 1.636 0 0 0 1.63 0z"></path>
                                            </svg>
                                            
                                            <span>{t("modpacks")}</span>
                                        </Link>
                                    </div>

                                    <div className="account-action">
                                        <Link href="/jams" onClick={() => setIsBrowseMenuOpen(false)} className="account-action__wrapper button--active-transform">
                                            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="icon lucide lucide-trophy-icon lucide-trophy" style={{ fill: "none", marginRight: "12px" }}>
                                                <path d="M10 14.66v1.626a2 2 0 0 1-.976 1.696A5 5 0 0 0 7 21.978"/>
                                                <path d="M14 14.66v1.626a2 2 0 0 0 .976 1.696A5 5 0 0 1 17 21.978"/>
                                                <path d="M18 9h1.5a1 1 0 0 0 0-5H18"/>
                                                <path d="M4 22h16"/>
                                                <path d="M6 9a6 6 0 0 0 12 0V3a1 1 0 0 0-1-1H7a1 1 0 0 0-1 1z"/>
                                                <path d="M6 9H4.5a1 1 0 0 1 0-5H6"/>
                                            </svg>

                                            <span>{t("modJams")}</span>
                                        </Link>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="header__right">
                        {isLoggedIn ? (
                            <>
                                <button className="button button--size-m button--type-secondary button--active-transform button--with-icon" onClick={openProjectModal}>
                                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="icon lucide lucide-plus-icon lucide-plus">
                                        <path d="M5 12h14"/>
                                        <path d="M12 5v14"/>
                                    </svg>
                                    
                                    {t("createProject")}
                                </button>

                                <div className="account-button" ref={buttonRef}>
                                    <div className="account-button__inner button--active-transform" onClick={toggleMenu}>
                                        {unreadCount > 0 && (
                                            <div className="header--bell__unread-count counter-label">{unreadLabel}</div>
                                        )}
                                        
                                        <div data-loaded="true" className="andropov-media andropov-media--rounded andropov-media--bordered andropov-media--has-preview andropov-image" style={{ aspectRatio: "1 / 1", width: "34px", height: "34px", maxWidth: "none", "--background-color": "var(--theme-color-background)" }}>
                                            <Image width={40} height={40} src={user?.avatar} alt="" loading="lazy" unoptimized />
                                        </div>

                                        <svg className={`icon icon--chevron_down ${isMenuOpen ? "rotate" : ""}`} width="20" height="20" viewBox="0 0 24 24">
                                            <path fillRule="evenodd" clipRule="evenodd" d="M17.707 8.793a1 1 0 0 1 0 1.414l-5 5a1 1 0 0 1-1.414 0l-5-5a1 1 0 1 1 1.414-1.414L12 13.086l4.293-4.293a1 1 0 0 1 1.414 0Z" fill="currentColor"></path>
                                        </svg>
                                    </div>

                                    <div className={`bubble account-menu-root user-menu ${isMenuOpen ? "open" : ""}`} ref={menuRef}>
                                        <div className="account-menu">
                                            <div className="account-menu__title">{t("myProfile")}</div>
                                            
                                            <Link href={`/user/${user?.slug}`} className="account-menu__user-card button--active-transform" onClick={closeAccountMenu}>
                                                <div className="andropov-media--cropped andropov-media andropov-media--rounded andropov-media--bordered andropov-image account-menu__avatar" style={{ aspectRatio: "480 / 320", width: "44px", height: "44px", maxWidth: "none", maxHeight: "none", backgroundColor: "var(--theme-color-background)" }}>
                                                    <Image width={44} height={44} src={user?.avatar} alt="" unoptimized />
                                                </div>

                                                <div className="account-menu__name">
                                                    {(user?.isRole === "admin" || user?.isRole === "moderator") && (                   
                                                        <svg width="20" height="20" viewBox="0 0 128 128" fill="none" xmlns="http://www.w3.org/2000/svg">
                                                            <path d="M56.6424 5.64827C60.6427 0.783909 68.0894 0.783909 72.0897 5.64827L82.8299 18.7088C84.696 20.9778 87.4657 22.311 90.4032 22.3553L107.311 22.6092C113.608 22.7042 118.251 28.527 116.942 34.6873L113.428 51.2274C112.817 54.1011 113.502 57.0975 115.299 59.4217L125.641 72.7996C129.493 77.782 127.836 85.0416 122.204 87.8592L107.081 95.4246C104.453 96.739 102.536 99.1419 101.84 101.996L97.8299 118.423C96.3363 124.541 89.6267 127.773 83.9119 125.126L68.5692 118.018C65.9033 116.784 62.8288 116.784 60.1629 118.018L44.8201 125.126C39.1054 127.773 32.3958 124.541 30.9022 118.423L26.8924 101.996C26.1956 99.1419 24.2787 96.739 21.6512 95.4246L6.52816 87.8592C0.896047 85.0416 -0.761059 77.782 3.09066 72.7996L13.4344 59.4217C15.2311 57.0976 15.915 54.1009 15.3045 51.2274L11.7899 34.6873C10.4809 28.5269 15.1245 22.7039 21.4217 22.6092L38.3289 22.3553C41.2665 22.3111 44.0361 20.977 45.9022 18.7078L56.6424 5.64827ZM65.1248 26.1942C64.6554 25.9221 64.0748 25.9221 63.6053 26.1942L28.7713 46.3856C28.3086 46.6538 28.0243 47.1465 28.0243 47.6785V86.0145C28.0244 86.549 28.3111 87.0431 28.7772 87.3104L63.6121 107.281C64.0783 107.548 64.6528 107.548 65.119 107.281L99.953 87.3104C100.419 87.0431 100.707 86.549 100.707 86.0145V47.6785C100.707 47.1465 100.422 46.6538 99.9588 46.3856L65.1248 26.1942ZM96.6912 49.0633V84.6336L64.3651 103.224L32.0399 84.6336V49.0633L64.3651 30.243L96.6912 49.0633ZM35.7537 50.9051V82.9071L64.3651 99.0799L92.9764 82.9071V50.9051L64.3651 34.3866L35.7537 50.9051ZM62.8582 68.1151V94.245L39.5584 81.0076V54.992L62.8582 68.1151ZM89.4041 80.9696L66.2196 94.1307V68.1532L89.4041 54.8768V80.9696ZM56.9461 87.5692L60.4237 89.5457V85.3817L56.9461 83.4256V87.5692ZM68.5379 85.3817V89.5457L72.0164 87.5692V83.4246L68.5379 85.3817ZM41.993 79.2811L45.5858 81.2381V77.0936L41.993 75.1375V79.2811ZM83.3758 77.0936V81.2381L86.9696 79.2811V75.1366L83.3758 77.0936ZM47.6727 75.2518L54.1639 78.8211V71.1082L47.6727 67.5399V75.2518ZM74.7977 71.1082V78.8201L81.2899 75.2518V67.5399L74.7977 71.1082ZM56.9461 72.4891L60.5399 74.4461V70.0721L56.9461 68.1151V72.4891ZM68.4227 70.0721V74.4461L72.0164 72.4891V68.1151L68.4227 70.0721ZM41.993 64.201L45.5858 66.158V62.0145L41.993 60.0575V64.201ZM83.3758 62.0145V66.158L86.9696 64.201V60.0575L83.3758 62.0145Z" fill="#307df0"/>
                                                        </svg>
                                                    )}

                                                    <div className="account-menu__name-label">{user?.username}</div>
                                                
                                                    {user?.isVerified === 1 && (
                                                        <img src="/badges/creator.webp" alt="Verified" style={{ width: "18px", pointerEvents: "none" }} />
                                                    )}
                                                </div>
                                            </Link>
                                            
                                            <div className="account-menu__section">
                                                {(user?.isRole === "admin" || user?.isRole === "moderator") && (
                                                    <div className="account-action">
                                                        <Link href="/moderation" className="account-action__wrapper button--active-transform" onClick={closeAccountMenu}>
                                                            <svg style={{ fill: "none", color: "#ffa347" }} className="icon icon--settings account-action__icon" height="24" width="24" xmlns="http://www.w3.org/2000/svg" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                                                                <path strokeLinecap="round" strokeLinejoin="round" d="m3 6 3 1m0 0-3 9a5 5 0 0 0 6.001 0M6 7l3 9M6 7l6-2m6 2 3-1m-3 1-3 9a5 5 0 0 0 6.001 0M18 7l3 9m-3-9-6-2m0-2v2m0 16V5m0 16H9m3 0h3"></path>
                                                            </svg>

                                                            <span>{t("moderation")}</span>
                                                        </Link>
                                                    </div>
                                                )}

                                                <div className="account-action">
                                                    <Link href="/dashboard" className="account-action__wrapper button--active-transform" onClick={closeAccountMenu}>
                                                        <svg style={{ fill: "none" }} className="icon icon--settings account-action__icon" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                            <path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z" />
                                                            <path d="m3.3 7 8.7 5 8.7-5" />
                                                            <path d="M12 22V12" />
                                                        </svg>

                                                        <span>{t("projects")}</span>
                                                    </Link>
                                                </div>

                                                <div className="account-action">
                                                    <Link href="/dashboard/organizations" className="account-action__wrapper button--active-transform" onClick={closeAccountMenu}>
                                                        <svg style={{ fill: "none" }} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="icon icon--settings account-action__icon lucide lucide-building2-icon lucide-building-2">
                                                            <path d="M10 12h4"></path>
                                                            <path d="M10 8h4"></path>
                                                            <path d="M14 21v-3a2 2 0 0 0-4 0v3"></path>
                                                            <path d="M6 10H4a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-2"></path>
                                                            <path d="M6 21V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v16"></path>
                                                        </svg>

                                                        <span>{t("organizations")}</span>
                                                    </Link>
                                                </div>

                                                <div className="account-action">
                                                    <Link href="/dashboard/likes" className="account-action__wrapper button--active-transform" onClick={closeAccountMenu}>
                                                        <svg style={{ fill: "none" }} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="icon icon--settings account-action__icon">
                                                            <path d="M2 9.5a5.5 5.5 0 0 1 9.591-3.676.56.56 0 0 0 .818 0A5.49 5.49 0 0 1 22 9.5c0 2.29-1.5 4-3 5.5l-5.492 5.313a2 2 0 0 1-3 .019L5 15c-1.5-1.5-3-3.2-3-5.5"></path>
                                                        </svg>

                                                        <span>{t("likes")}</span>
                                                    </Link>
                                                </div>

                                                <div className="account-action">
                                                    <Link href="/notifications" className="account-action__wrapper button--active-transform" onClick={closeAccountMenu}>
                                                        <svg className="icon icon--settings account-action__icon" height="24" width="24" viewBox="0 0 24 24">
                                                            <path d="M5 10a7 7 0 0 1 14 0v3.764l1.532 3.065A1.5 1.5 0 0 1 19.191 19H15a3 3 0 0 1-6 0H4.809a1.5 1.5 0 0 1-1.342-2.17L5 13.763V10Zm6 9a1 1 0 1 0 2 0h-2Zm1-14a5 5 0 0 0-5 5v4a1 1 0 0 1-.106.447L5.618 17H18.38l-1.276-2.553A1 1 0 0 1 17 14v-4a5 5 0 0 0-5-5Z"></path>
                                                        </svg>

                                                        <span>{t("notifications")}</span>

                                                        {unreadCount > 0 && (
                                                            <div className="account-menu--bell__unread-count counter-label">{unreadLabel}</div>
                                                        )}
                                                    </Link>
                                                </div>

                                                <div className="account-action">
                                                    <Link href="/settings" className="account-action__wrapper button--active-transform" onClick={closeAccountMenu}>
                                                        <svg className="icon icon--settings account-action__icon" height="24" width="24" viewBox="0 0 24 24">
                                                            <path fillRule="evenodd" clipRule="evenodd" d="M11.997 2c-.824 0-1.506.177-2.04.588-.523.404-.771.934-.925 1.336l-.181.491c-.195.543-.268.747-.604.918-.362.186-.595.137-1.128.023-.154-.032-.333-.07-.547-.11-.428-.078-.991-.135-1.602.085-.615.22-1.14.668-1.618 1.331-.457.636-.66 1.287-.592 1.957.062.624.35 1.138.592 1.518.111.176.208.318.295.446.137.201.251.37.369.587.162.3.244.558.244.83 0 .26-.08.512-.243.812-.117.216-.23.382-.364.579-.089.13-.187.276-.302.458-.242.383-.53.9-.591 1.524-.067.67.134 1.324.592 1.961.477.663 1.003 1.111 1.617 1.332.61.22 1.174.164 1.601.086.215-.039.394-.077.548-.11.533-.112.766-.161 1.13.025.335.172.408.375.603.918.05.14.108.301.18.49.155.403.403.934.927 1.337.533.41 1.215.588 2.039.588.824 0 1.505-.177 2.039-.588.524-.403.771-.934.926-1.336.072-.19.13-.352.18-.491.196-.543.27-.746.605-.918.363-.186.597-.137 1.129-.024.154.032.333.07.548.11.428.077.99.133 1.601-.087.614-.22 1.14-.67 1.617-1.332.458-.637.66-1.29.593-1.96-.063-.625-.35-1.142-.591-1.525a15.718 15.718 0 0 0-.303-.459c-.134-.196-.246-.362-.364-.578-.163-.3-.243-.552-.243-.812 0-.272.082-.53.244-.83.118-.217.233-.386.37-.587.087-.128.183-.27.294-.446.242-.38.53-.894.593-1.518.067-.67-.136-1.321-.593-1.957-.477-.663-1.003-1.111-1.618-1.332-.61-.219-1.174-.162-1.602-.084-.214.04-.393.078-.547.11-.533.114-.767.163-1.129-.022-.335-.172-.409-.376-.603-.919-.05-.14-.109-.301-.181-.49-.155-.403-.402-.933-.926-1.337-.534-.41-1.215-.588-2.04-.588Zm5.528 14.727c-.584-.138-1.627-.385-2.69.16h-.001c-1.115.571-1.468 1.653-1.66 2.237a5.33 5.33 0 0 1-.08.235c-.112.294-.196.405-.279.469-.073.056-.273.172-.818.172-.545 0-.746-.116-.819-.172-.083-.064-.166-.175-.28-.469a5.188 5.188 0 0 1-.08-.235c-.19-.584-.544-1.666-1.658-2.237-1.064-.545-2.107-.298-2.691-.16-.1.024-.185.044-.256.057-.293.053-.444.044-.567 0-.12-.043-.347-.17-.67-.618-.23-.32-.236-.497-.226-.594.014-.143.087-.331.291-.654.048-.076.114-.173.188-.284.17-.254.388-.578.545-.866.257-.473.486-1.06.486-1.768 0-.714-.227-1.304-.485-1.782-.16-.296-.38-.622-.552-.877a13.423 13.423 0 0 1-.183-.276c-.205-.322-.276-.507-.29-.646-.01-.093-.005-.268.226-.589.323-.449.55-.574.669-.617.123-.044.273-.053.567 0 .07.014.156.034.255.058.584.139 1.628.388 2.693-.158 1.114-.571 1.468-1.653 1.659-2.237.03-.092.055-.172.08-.235.113-.294.196-.405.279-.468.073-.057.274-.173.819-.173.545 0 .745.116.818.173.083.063.167.174.28.468.024.063.05.143.08.235.19.584.544 1.666 1.659 2.237 1.064.546 2.108.297 2.692.158.1-.024.186-.044.256-.057.294-.054.445-.045.567 0 .12.042.347.168.67.616.23.321.235.496.226.59-.014.138-.086.323-.29.645-.048.075-.112.169-.184.276l-.552.877c-.258.478-.485 1.068-.485 1.782 0 .709.23 1.295.486 1.768.157.288.375.612.546.866.074.11.14.208.187.284.204.323.277.511.292.654.01.097.003.274-.227.594-.323.449-.55.575-.67.618-.123.044-.273.053-.567 0-.07-.013-.156-.033-.256-.056Z" fill="currentColor"></path>
                                                            <path fillRule="evenodd" clipRule="evenodd" d="M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8Zm0 2a2 2 0 1 0 0 4 2 2 0 0 0 0-4Z" fill="currentColor"></path>
                                                        </svg>

                                                        <span>{t("settings")}</span>
                                                    </Link>
                                                </div>

                                                <div className="account-action">
                                                    <div onClick={() => { closeAccountMenu(); logout(); }} className="account-action__wrapper button--active-transform">
                                                        <svg className="icon icon--logout account-action__icon" height="24" width="24" viewBox="0 0 24 24">
                                                            <path fillRule="evenodd" clipRule="evenodd" d="M3 7a4 4 0 0 1 4-4h3a1 1 0 1 1 0 2H7a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h3a1 1 0 1 1 0 2H7a4 4 0 0 1-4-4V7Zm11.293-.707a1 1 0 0 1 1.414 0l5 5a1 1 0 0 1 0 1.414l-5 5a1 1 0 0 1-1.414-1.414L17.586 13H9a1 1 0 1 1 0-2h8.586l-3.293-3.293a1 1 0 0 1 0-1.414Z" fill="currentColor"></path>
                                                        </svg>

                                                        <span>{t("logout")}</span>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </>
                        ) : (
                            <>
                                <button onClick={openLoginModal} className="button button--size-l button--type-primary button--rounded button--with-icon button--active-transform" type="button">
                                    <svg style={{ width: "18px", height: "18px" }}xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-log-in-icon lucide-log-in">
                                        <path d="m10 17 5-5-5-5"/>
                                        <path d="M15 12H3"/>
                                        <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/>
                                    </svg>
                                    
                                    {t("login")}
                                </button>

                                <Link href="/settings/appearance" className="button button--size-l button--type-secondary button--rounded button--icon-only button--active-transform" aria-label={t("settings")} style={{ width: "42px" }}>
                                    <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-settings-icon lucide-settings" style={{ fill: "none" }}>
                                        <path d="M9.671 4.136a2.34 2.34 0 0 1 4.659 0 2.34 2.34 0 0 0 3.319 1.915 2.34 2.34 0 0 1 2.33 4.033 2.34 2.34 0 0 0 0 3.831 2.34 2.34 0 0 1-2.33 4.033 2.34 2.34 0 0 0-3.319 1.915 2.34 2.34 0 0 1-4.659 0 2.34 2.34 0 0 0-3.32-1.915 2.34 2.34 0 0 1-2.33-4.033 2.34 2.34 0 0 0 0-3.831A2.34 2.34 0 0 1 6.35 6.051a2.34 2.34 0 0 0 3.319-1.915"></path>
                                        <circle cx="12" cy="12" r="3"></circle>
                                    </svg>
                                </Link>
                            </>
                        )}
                    </div>
                </div>
            </div>

            <LoginModal isOpen={loginModalOpen} onClose={closeModals} />
            <ProjectCreationModal isOpen={projectModalOpen} authToken={authToken} onRequestClose={closeModals} />
        </>
    );
}