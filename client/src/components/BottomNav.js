import React, { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import miningActiveImg from "../images/mining active.png";
import tasksActiveImg from "../images/tasks active.png";
import upgradeActiveImg from "../images/upgrade active.png";
import walletActiveImg from "../images/wallet active.png";

const navItems = [
  { key: "play", label: "Mine", path: "/play" },
  { key: "tasks", label: "Tasks", path: "/tasks" },
  { key: "upgrade", label: "Upgrade", path: "/upgrade" },
  { key: "wallet", label: "Wallet", path: "/wallet" },
];

// Preload all images
const preloadImages = () => {
  const images = [miningActiveImg, tasksActiveImg, upgradeActiveImg, walletActiveImg];
  images.forEach((src) => {
    const img = new Image();
    img.src = src;
  });
};

function BottomNav({ active, onChange }) {
  const navigate = useNavigate();

  // Preload all images on component mount
  useEffect(() => {
    preloadImages();
  }, []);

  const handleNavClick = (item) => {
    onChange(item.key);
    navigate(item.path);
  };

  const getBackgroundForActive = () => {
    switch (active) {
      case "play":
        return miningActiveImg;
      case "tasks":
        return tasksActiveImg;
      case "upgrade":
        return upgradeActiveImg;
      case "wallet":
        return walletActiveImg;
      default:
        return miningActiveImg;
    }
  };

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-10"
      style={{
        backgroundColor: "#08080A",
        backgroundImage: `url("${getBackgroundForActive()}")`,
        backgroundRepeat: "no-repeat",
        backgroundPosition: "bottom center",
        backgroundSize: "100% 100%",
        height: "109px",
        transition: "background-image 0.2s ease-in-out",
        willChange: "background-image",
      }}
    >
      <div className="relative mx-auto max-w-md flex justify-between items-stretch" style={{ height: "100%" }}>
        {navItems.map((item) => (
          <button
            key={item.key}
            onClick={() => handleNavClick(item)}
            className="w-1/4 h-full"
            aria-label={item.label}
            title={item.label}
            style={{ background: "transparent" }}
          />
        ))}
      </div>
    </nav>
  );
}

export default BottomNav;
