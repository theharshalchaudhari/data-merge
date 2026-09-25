"use client";

import { useState } from "react";

type FolderProps = {
  color?: string;
  size?: number;
  items?: React.ReactNode[];
  className?: string;
  onClick?: () => void;
  label?: string;
  description?: string;
};

function darkenColor(
  hex: string,
  percent: number,
) {
  let color = hex.startsWith("#")
    ? hex.slice(1)
    : hex;

  if (color.length === 3) {
    color = color
      .split("")
      .map((char) => char + char)
      .join("");
  }

  const num = parseInt(
    color.slice(0, 6),
    16,
  );

  let r = (num >> 16) & 0xff;
  let g = (num >> 8) & 0xff;
  let b = num & 0xff;

  r = Math.max(
    0,
    Math.min(
      255,
      Math.floor(r * (1 - percent)),
    ),
  );

  g = Math.max(
    0,
    Math.min(
      255,
      Math.floor(g * (1 - percent)),
    ),
  );

  b = Math.max(
    0,
    Math.min(
      255,
      Math.floor(b * (1 - percent)),
    ),
  );

  return (
    "#" +
    (
      (1 << 24) +
      (r << 16) +
      (g << 8) +
      b
    )
      .toString(16)
      .slice(1)
      .toUpperCase()
  );
}

export default function Folder({
  color = "#5227FF",
  size = 1,
  items = [],
  className = "",
  onClick,
  label,
  description,
}: FolderProps) {
  const maxItems = 3;

  const papers = items.slice(
    0,
    maxItems,
  );

  while (
    papers.length < maxItems
  ) {
    papers.push(null);
  }

  const [open, setOpen] =
    useState(false);

  const [
    paperOffsets,
    setPaperOffsets,
  ] = useState(
    Array.from(
      { length: maxItems },
      () => ({
        x: 0,
        y: 0,
      }),
    ),
  );

  const folderBackColor =
    darkenColor(color, 0.08);

  const paperColors = [
    darkenColor("#ffffff", 0.1),
    darkenColor("#ffffff", 0.05),
    "#ffffff",
  ];

  function handleClick() {
    const nextOpen = !open;

    setOpen(nextOpen);

    if (!nextOpen) {
      setPaperOffsets(
        Array.from(
          {
            length: maxItems,
          },
          () => ({
            x: 0,
            y: 0,
          }),
        ),
      );
    }

    if (nextOpen) {
      onClick?.();
    }
  }

  function handlePaperMouseMove(
    event: React.MouseEvent,
    index: number,
  ) {
    if (!open) {
      return;
    }

    const rect =
      event.currentTarget.getBoundingClientRect();

    const centerX =
      rect.left +
      rect.width / 2;

    const centerY =
      rect.top +
      rect.height / 2;

    const offsetX =
      (event.clientX - centerX) *
      0.15;

    const offsetY =
      (event.clientY - centerY) *
      0.15;

    setPaperOffsets(
      (previous) => {
        const next = [...previous];

        next[index] = {
          x: offsetX,
          y: offsetY,
        };

        return next;
      },
    );
  }

  function handlePaperMouseLeave(
    index: number,
  ) {
    setPaperOffsets(
      (previous) => {
        const next = [...previous];

        next[index] = {
          x: 0,
          y: 0,
        };

        return next;
      },
    );
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      className={[
        "group flex w-42.5 flex-col items-center",
        "rounded-xl border-0 bg-transparent",
        "p-4 text-center",
        "transition-colors duration-200",
        "hover:bg-muted/50",
        "focus:outline-none",
        "focus-visible:ring-2",
        "focus-visible:ring-ring",
        "focus-visible:ring-offset-2",
        className,
      ].join(" ")}
      aria-label={
        label
          ? `Open ${label}`
          : "Open folder"
      }
    >
      <div
        className="relative h-24 w-28 transition-transform duration-200 group-hover:-translate-y-2"
        style={{
          transform: `scale(${size})`,
        }}
      >
        <div
          className={[
            "absolute left-0 top-2",
            "h-20 w-28",
            "rounded-b-[10px]",
            "rounded-tr-[10px]",
            "transition-transform duration-300",
            open
              ? "-translate-y-2"
              : "",
          ].join(" ")}
          style={{
            backgroundColor:
              folderBackColor,
          }}
        >
          <div
            className="absolute -top-2 left-0 h-3 w-9 rounded-t-md"
            style={{
              backgroundColor:
                folderBackColor,
            }}
          />

          {papers.map(
            (
              item,
              index,
            ) => {
              const offset =
                paperOffsets[
                  index
                ];

              let transform =
                "translate(-50%, 10%)";

              if (
                open &&
                index === 0
              ) {
                transform =
                  "translate(-120%, -70%) rotate(-15deg)";
              }

              if (
                open &&
                index === 1
              ) {
                transform =
                  "translate(10%, -70%) rotate(15deg)";
              }

              if (
                open &&
                index === 2
              ) {
                transform =
                  "translate(-50%, -100%) rotate(5deg)";
              }

              return (
                <div
                  key={index}
                  onMouseMove={(
                    event,
                  ) =>
                    handlePaperMouseMove(
                      event,
                      index,
                    )
                  }
                  onMouseLeave={() =>
                    handlePaperMouseLeave(
                      index,
                    )
                  }
                  className={[
                    "absolute bottom-[10%] left-1/2",
                    "z-2",
                    "rounded-[10px]",
                    "transition-all duration-300",
                    "ease-in-out",
                    index === 0
                      ? "h-[80%] w-[70%]"
                      : index === 1
                        ? "h-[70%] w-[80%]"
                        : "h-[60%] w-[90%]",
                  ].join(" ")}
                  style={{
                    backgroundColor:
                      paperColors[
                        index
                      ],
                    transform: `${transform} translate(${offset.x}px, ${offset.y}px)`,
                  }}
                >
                  {item}
                </div>
              );
            },
          )}

          <div
            className={[
              "absolute inset-0 z-3",
              "h-full w-full",
              "rounded-[5px] rounded-tr-[10px]",
              "rounded-br-[10px]",
              "transition-all duration-300",
              "ease-in-out",
              "origin-bottom",
              open
                ? "skew-x-15 scale-y-[0.6]"
                : "",
            ].join(" ")}
            style={{
              backgroundColor: color,
            }}
          />

          <div
            className={[
              "absolute inset-0 z-3",
              "h-full w-full",
              "rounded-[5px] rounded-tr-[10px]",
              "rounded-br-[10px]",
              "transition-all duration-300",
              "ease-in-out",
              "origin-bottom",
              open
                ? "skew-x-[-15deg] scale-y-[0.6]"
                : "",
            ].join(" ")}
            style={{
              backgroundColor: color,
            }}
          />
        </div>
      </div>

      {label && (
        <div className="mt-4 flex w-full flex-col items-center gap-1">
          <span className="w-full truncate text-sm font-semibold">
            {label}
          </span>

          {description && (
            <span className="w-full truncate text-xs text-muted-foreground">
              {description}
            </span>
          )}
        </div>
      )}
    </button>
  );
}