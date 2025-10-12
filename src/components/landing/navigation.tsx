"use client";

import Link from "next/link";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Menu, X } from "lucide-react";
import { useState } from "react";

export const Navigation = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  return (
    <header className="fixed top-0 w-full z-50 bg-white/80 backdrop-blur-lg border-b border-gray-200">
      <nav className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2 group">
            <div className="relative">
              <Image 
                src="/Logo.png" 
                alt="Fairlx" 
                width={32} 
                height={32} 
                className="transition-transform group-hover:scale-110"
              />
            </div>
            <span className="text-xl font-bold text-gray-900 group-hover:text-blue-600 transition-colors">
              Fairlx
            </span>
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center space-x-8">
            <Link 
              href="#features" 
              className="text-gray-600 hover:text-gray-900 transition-all duration-200 relative group"
            >
              Features
              <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-blue-600 transition-all duration-200 group-hover:w-full"></span>
            </Link>
            <Link 
              href="#solutions" 
              className="text-gray-600 hover:text-gray-900 transition-all duration-200 relative group"
            >
              Solutions
              <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-blue-600 transition-all duration-200 group-hover:w-full"></span>
            </Link>
            <Link 
              href="#pricing" 
              className="text-gray-600 hover:text-gray-900 transition-all duration-200 relative group"
            >
              Pricing
              <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-blue-600 transition-all duration-200 group-hover:w-full"></span>
            </Link>
          </div>

          {/* CTA Buttons */}
          <div className="hidden md:flex items-center space-x-3">
            <Button 
              variant="ghost" 
              asChild 
              className="hover:bg-blue-50 hover:text-blue-600 transition-all duration-200"
            >
              <Link href="/sign-in">Sign In</Link>
            </Button>
            <Button 
              asChild 
              className="bg-blue-600 hover:bg-blue-700 transition-all duration-200 shadow-lg hover:shadow-blue-200 hover:shadow-xl"
            >
              <Link href="/sign-up">Sign Up</Link>
            </Button>
          </div>

          {/* Mobile menu button */}
          <button
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            className="md:hidden p-2 rounded-lg hover:bg-gray-100 transition-colors"
          >
            {isMenuOpen ? (
              <X className="h-6 w-6" />
            ) : (
              <Menu className="h-6 w-6" />
            )}
          </button>
        </div>

        {/* Mobile Navigation */}
        {isMenuOpen && (
          <div className="md:hidden py-4 border-t border-gray-200 bg-white/95 backdrop-blur-lg">
            <div className="flex flex-col space-y-4">
              <Link 
                href="#features" 
                className="text-gray-600 hover:text-gray-900 transition-colors px-2 py-1"
                onClick={() => setIsMenuOpen(false)}
              >
                Features
              </Link>
              <Link 
                href="#solutions" 
                className="text-gray-600 hover:text-gray-900 transition-colors px-2 py-1"
                onClick={() => setIsMenuOpen(false)}
              >
                Solutions
              </Link>
              <Link 
                href="#pricing" 
                className="text-gray-600 hover:text-gray-900 transition-colors px-2 py-1"
                onClick={() => setIsMenuOpen(false)}
              >
                Pricing
              </Link>
              <div className="flex flex-col space-y-2 pt-4 border-t border-gray-200">
                <Button variant="ghost" asChild className="justify-start">
                  <Link href="/sign-in">Sign In</Link>
                </Button>
                <Button asChild className="bg-blue-600 hover:bg-blue-700">
                  <Link href="/sign-up">Get Demo</Link>
                </Button>
              </div>
            </div>
          </div>
        )}
      </nav>
    </header>
  );
}
