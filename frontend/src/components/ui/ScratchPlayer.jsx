import React, { useEffect, useRef, useState } from "react";
import "../../styles/ScratchPlayer.css";

export default function ScratchPlayer({ projectId, title, description }) {
  const [loaded, setLoaded] = useState(false);
  const [shouldLoad, setShouldLoad] = useState(false);
  const wrapperRef = useRef(null);

  const src = `https://scratch.mit.edu/projects/${projectId}/embed`;

  useEffect(() => {
    setLoaded(false);
    setShouldLoad(false);
  }, [projectId]);

  const handleStart = () => {
    setShouldLoad(true);
  };


  return (
    <div className="scratch-player">
      <div className="scratch-player__frame" ref={wrapperRef}>
        {!shouldLoad ? (
          <div className="scratch-player__intro">
            <div className="scratch-player__intro-badge">Scratch</div>
            <h3>{title}</h3>
            <p>{description}</p>
            <button type="button" className="scratch-player__start" onClick={handleStart}>
              Bắt đầu chơi
            </button>
          </div>
        ) : (
          <>
            {!loaded && <div className="scratch-player__skeleton" />}
            <iframe
              className={`scratch-player__iframe ${loaded ? "scratch-player__iframe--visible" : ""}`}
              src={src}
              title={`Scratch project ${title || projectId}`}
              allowFullScreen
              loading="lazy"
              onLoad={() => setLoaded(true)}
            />
          </>
        )}
      </div>

      <div className="scratch-player__footer">
        <div className="scratch-player__footer-avatar">
          <span role="img" aria-label="Larry">
            🤖
          </span>
        </div>
        <p>Larry luôn ở đây để đồng hành cùng bạn.</p>
      </div>
    </div>
  );
}
