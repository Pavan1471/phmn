import React from "react";
import { useNavigate } from "react-router-dom";
import leftFrameImg from "../images/topnav/left frame.png";
import middleTopImg from "../images/topnav/middle top.png";
import middleBottomImg from "../images/topnav/middle bottom.png";
import rectangleImg from "../images/topnav/Rectangle 141.png";
import rightFrameImg from "../images/topnav/right frame.png";
import topIconImg from "../images/topnav/top icon.png";
import minerOptionsImg from "../images/miner-options.png";

function TopNav({ user, energy, level, score, onTopPlayerClick, onOptionsClick }) {
  const navigate = useNavigate();
  
  return (
    <nav
      className="fixed top-0 left-0 right-0 z-50"
      style={{
        backgroundColor: "#1a0526",
        height: "82px",
        overflow: "hidden",
      }}
    >
      <div className="relative mx-auto max-w-md h-full">
        {/* Left Frame */}
        <div
          className="absolute left-0 top-0 bottom-0 flex flex-col items-center justify-center cursor-pointer"
          role="button"
          aria-label="Leaderboard"
          tabIndex={0}
          onClick={() => onTopPlayerClick && onTopPlayerClick()}
          onKeyDown={(event) => {
            if ((event.key === "Enter" || event.key === " ") && onTopPlayerClick) {
              event.preventDefault();
              onTopPlayerClick();
            }
          }}
          style={{
            width: "100px",
            backgroundImage: `url("${leftFrameImg}")`,
            backgroundRepeat: "no-repeat",
            backgroundPosition: "left center",
            backgroundSize: "contain",
            zIndex: 3,
          }}
        >
          <img 
            src={topIconImg} 
            alt="Top icon" 
            className="w-4 h-4 mb-1 mr-4"
          />
          <span className="text-white text-[10px] mr-4">TOP Players</span>
        </div>
        
        {/* Right Frame */}
        <div
          className="absolute right-0 top-0 bottom-0 flex flex-col items-center justify-center cursor-pointer"
          role="button"
          aria-label="Miner Options"
          tabIndex={0}
          onClick={() => navigate('/upgrade')}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              navigate('/upgrade');
            }
          }}
          style={{
            width: "100px",
            backgroundImage: `url("${rightFrameImg}")`,
            backgroundRepeat: "no-repeat",
            backgroundPosition: "right center",
            backgroundSize: "contain",
            zIndex: 3,
          }}
        >
          <img 
            src={minerOptionsImg} 
            alt="Miner Options" 
            className="w-4 h-4 mb-1 ml-4"
          />
          <span className="text-white text-[10px] ml-4">Miner Options</span>
        </div>
        
        {/* Middle Section */}
        <div className="absolute left-20 right-20 top-0 bottom-0">
          {/* Middle Top - positioned at the very top edge */}
          <div
            className="absolute top-0  left-0 right-0"
            style={{
              height: "60px",
              backgroundImage: `url("${middleTopImg}")`,
              backgroundRepeat: "no-repeat",
              backgroundPosition: "center center",
              backgroundSize: "90% 60%",
            }}
          />
          
          {/* Middle Bottom - positioned at the very bottom edge */}
          <div
            className="absolute bottom-0 left-0 right-0"
            style={{
              height: "22px",
              backgroundImage: `url("${middleBottomImg}")`,
              backgroundRepeat: "no-repeat",
              backgroundPosition: "center center",
              backgroundSize: "90% 100%",
            }}
          />
          
          {/* Rectangle 141 - Center Content Area - positioned between top and bottom */}
          <div
            className="absolute left-0 right-0 top-2 bottom-0 flex items-center justify-center"
            style={{
              backgroundImage: `url("${rectangleImg}")`,
              backgroundRepeat: "no-repeat",
              backgroundPosition: "center",
              backgroundSize: "70% 4%",
              zIndex: 2,
            }}
          >
            {/* Content */}
            <div className="flex items-center justify-between w-full">
              
              {/* Center content */}
              <div className="flex flex-col items-center flex-1 mb-10">
                {user && (
                  <div className="flex items-center px-4">
                    {user.photo_url && (
                      <img
                        src={user.photo_url}
                        alt={user.first_name || "User"}
                        className="w-8 h-8 rounded-full mr-2 border-2 border-yellow-400"
                      />
                    )}
                    <span className="text-white text-[10px] uppercase">
                      {user.first_name || "User"}
                      {user.last_name && ` ${user.last_name}`}
                    </span>
                  </div>
                )}
              </div>
              

            </div>
          </div>
        </div>
      </div>
    </nav>
  );
}

export default TopNav;

