"use client";

import { motion, useMotionValue, useSpring, useTransform } from "framer-motion";
import { cn } from "@/lib/utils";
import React from "react";
import { BackgroundGradient } from "@/components/ui/background-gradient";

type WobbleCardProps = {
  children: React.ReactNode;
  className?: string;
  containerClassName?: string;
};

export function WobbleCard({ children, className, containerClassName }: WobbleCardProps) {
  const x = useMotionValue(0);
  const y = useMotionValue(0);

  const springX = useSpring(x, { stiffness: 300, damping: 30 });
  const springY = useSpring(y, { stiffness: 300, damping: 30 });

  const rotateX = useTransform(springY, [-50, 50], [8, -8]);
  const rotateY = useTransform(springX, [-50, 50], [-8, 8]);

  function onMouseMove(event: React.MouseEvent<HTMLDivElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    const px = event.clientX - rect.left - rect.width / 2;
    const py = event.clientY - rect.top - rect.height / 2;
    x.set(px);
    y.set(py);
  }

  function onMouseLeave() {
    x.set(0);
    y.set(0);
  }

  return (
    <div className={cn("relative", containerClassName)}>
      <motion.div
        className={cn(className)}
        style={{ rotateX, rotateY }}
        onMouseMove={onMouseMove}
        onMouseLeave={onMouseLeave}
      >
        <BackgroundGradient className="rounded-2xl p-0">
          {children}
        </BackgroundGradient>
      </motion.div>
    </div>
  );
}


