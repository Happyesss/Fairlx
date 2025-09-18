"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { usePathname } from "next/navigation";

const images = [
  "/auth/auth1.jpg",
  "/auth/auth2.jpg",
  "/auth/auth3.jpg",
];

export const ImageCarousel = () => {
  const [currentImage, setCurrentImage] = useState(0);
  const pathname = usePathname();
  const isSignUpPage = pathname === "/sign-up"

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentImage((prev) => (prev === images.length - 1 ? 0 : prev + 1));
    }, 5000);

    return () => clearInterval(timer);
  }, []);

  return (
    <div className="relative h-full w-full overflow-hidden">
      {images.map((image, index) => (
        <div
          key={index}
          className={`absolute inset-0 transition-opacity duration-1000 ease-in-out ${index === currentImage ? "opacity-100" : "opacity-0"
            }`}
        >
          <Image
            src={image}
            alt={`Carousel image ${index + 1}`}
            fill
            className="object-cover"
            priority={index === 0}
          />
        </div>
      ))}
      <div className={`absolute ${isSignUpPage ? "bottom-14" : "bottom-6"} left-1/2 flex -translate-x-1/2 gap-2`}>
        {images.map((_, index) => (
          <button
            key={index}
            onClick={() => setCurrentImage(index)}
            className={`h-2 w-2 rounded-full transition-all ${index === currentImage
              ? "bg-white w-6"
              : "bg-white/50 hover:bg-white/75"
              }`}
          />
        ))}
      </div>
    </div>
  );
};
