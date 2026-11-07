import { type CSSProperties, useEffect, useId, useRef, useState } from "react";

interface LiquidGlassPanelProps {
  radius: number;
  children: React.ReactNode;
  className?: string;
  style?: CSSProperties;
}

const CARD_DISPLACEMENT =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAgAAAAICAYAAADED76LAAAAJ0lEQVQoU2NkYGA4z8DAwMAMwYigwEFm0gs2k5m0go3MzExgYAAAiB0EFHARFEQAAAAASUVORK5CYII=";

export default function LiquidGlassPanel({
  children,
  radius,
  className,
  style
}: LiquidGlassPanelProps) {
  const filterId = useId().replace(/[:]/g, "");
  const hostRef = useRef<HTMLDivElement | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (hostRef.current) setReady(true);
  }, []);

  return (
    <div ref={hostRef} className={className} style={{ position: "relative", ...style }}>
      <svg aria-hidden="true" style={{ position: "absolute", width: 0, height: 0 }}>
        <defs>
          <filter
            id={filterId}
            x="-20%"
            y="-20%"
            width="140%"
            height="140%"
            colorInterpolationFilters="sRGB"
          >
            <feImage href={CARD_DISPLACEMENT} result="MAP" preserveAspectRatio="none" />
            <feDisplacementMap
              in="SourceGraphic"
              in2="MAP"
              scale={18}
              xChannelSelector="R"
              yChannelSelector="G"
            />
            <feGaussianBlur stdDeviation={0.4} />
          </filter>
        </defs>
      </svg>
      <div
        className="liquid-glass-inner"
        style={{
          position: "relative",
          borderRadius: `${radius}px`,
          overflow: "hidden",
          width: "100%",
          height: "100%"
        }}
      >
        <span
          aria-hidden="true"
          style={{
            position: "absolute",
            inset: 0,
            filter: ready ? `url(#${filterId})` : undefined,
            backdropFilter: "blur(20px) saturate(170%)",
            WebkitBackdropFilter: "blur(20px) saturate(170%)",
            background:
              "linear-gradient(135deg, rgba(255,255,255,0.18), rgba(255,255,255,0.05) 45%, rgba(255,255,255,0.12))",
            borderRadius: "inherit",
            pointerEvents: "none"
          }}
        />
        <span
          aria-hidden="true"
          style={{
            position: "absolute",
            inset: 0,
            borderRadius: "inherit",
            pointerEvents: "none",
            boxShadow:
              "inset 0 0 0 1px rgba(255,255,255,0.30), inset 0 1.5px 0.5px rgba(255,255,255,0.5), inset 0 -1px 1px rgba(255,255,255,0.14)"
          }}
        />
        <span
          aria-hidden="true"
          style={{
            position: "absolute",
            inset: 0,
            borderRadius: "inherit",
            pointerEvents: "none",
            mixBlendMode: "screen",
            opacity: 0.16,
            padding: "1.2px",
            WebkitMask: "linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0)",
            WebkitMaskComposite: "xor",
            maskComposite: "exclude",
            background:
              "linear-gradient(135deg, rgba(255,255,255,0), rgba(255,255,255,0.35) 40%, rgba(255,255,255,0.5) 62%, rgba(255,255,255,0))"
          }}
        />
        <div style={{ position: "relative", zIndex: 1, height: "100%" }}>{children}</div>
      </div>
    </div>
  );
}
