"use client";

import Image from "next/image";
import { Github, Twitter, Linkedin, Mail, Heart } from "lucide-react";

export const Footer = () => {
  return (
    <>
      <style jsx>{`
        @keyframes slideUp {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes float {
          0%, 100% {
            transform: translateY(0px);
          }
          50% {
            transform: translateY(-10px);
          }
        }

        .footer-animate {
          animation: slideUp 0.8s ease-out forwards;
        }

        .social-icon {
          transition: all 0.3s ease;
        }

        .social-icon:hover {
          transform: translateY(-3px) scale(1.1);
          filter: drop-shadow(0 10px 20px rgba(0, 0, 0, 0.1));
        }

        .footer-link {
          position: relative;
          transition: all 0.3s ease;
        }

        .footer-link::after {
          content: '';
          position: absolute;
          bottom: -2px;
          left: 0;
          width: 0;
          height: 1px;
          background: linear-gradient(90deg, #3b82f6, #8b5cf6);
          transition: width 0.3s ease;
        }

        .footer-link:hover::after {
          width: 100%;
        }

        .heart-beat {
          animation: float 2s ease-in-out infinite;
        }

        .gradient-text {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }
      `}</style>

      <footer className="bg-gradient-to-br from-gray-50 to-white border-t border-gray-100 footer-animate overflow-x-hidden relative">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            {/* Brand Section */}
            <div className="col-span-1 md:col-span-2">
              <div className="flex items-center gap-2 mb-4 group">
                <div className="relative">
                  <Image 
                    src="/Logo.png" 
                    alt="Fairlx" 
                    width={40} 
                    height={32}
                    className="transition-transform duration-300 group-hover:scale-110"
                  />
                  <div className="absolute inset-0 bg-gradient-to-r from-blue-500 to-purple-500 rounded-lg opacity-0 group-hover:opacity-20 transition-opacity duration-300"></div>
                </div>
                <span className="text-xl font-bold gradient-text">
                  ChronoTask
                </span>
              </div>
              <p className="text-gray-600 mb-6 max-w-md leading-relaxed">
                Streamline your project management with our modern, intuitive platform. 
                Built for teams that want to move fast and stay organized.
              </p>
              
              {/* Social Links */}
              <div className="flex space-x-4">
                {[
                  { icon: Github, href: "#", label: "GitHub" },
                  { icon: Twitter, href: "#", label: "Twitter" },
                  { icon: Linkedin, href: "#", label: "LinkedIn" },
                  { icon: Mail, href: "mailto:hello@chronotask.com", label: "Email" },
                ].map((social) => (
                  <a
                    key={social.label}
                    href={social.href}
                    className="social-icon p-2 bg-white rounded-lg shadow-sm hover:shadow-md border border-gray-200 hover:border-blue-300"
                    aria-label={social.label}
                  >
                    <social.icon className="h-5 w-5 text-gray-600 hover:text-blue-600" />
                  </a>
                ))}
              </div>
            </div>

            {/* Product Links */}
            <div>
              <h3 className="font-semibold text-gray-900 mb-4">Product</h3>
              <ul className="space-y-3">
                {["Features", "Pricing", "Security", "Integrations", "API"].map((item) => (
                  <li key={item}>
                    <a 
                      href={`#${item.toLowerCase()}`} 
                      className="footer-link text-gray-600 hover:text-gray-900"
                    >
                      {item}
                    </a>
                  </li>
                ))}
              </ul>
            </div>

            {/* Company Links */}
            <div>
              <h3 className="font-semibold text-gray-900 mb-4">Company</h3>
              <ul className="space-y-3">
                {["About", "Blog", "Careers", "Contact", "Privacy"].map((item) => (
                  <li key={item}>
                    <a 
                      href={`#${item.toLowerCase()}`} 
                      className="footer-link text-gray-600 hover:text-gray-900"
                    >
                      {item}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Bottom Section */}
          <div className="mt-12 pt-8 border-t border-gray-200">
            <div className="flex flex-col md:flex-row justify-between items-center space-y-4 md:space-y-0">
              <div className="flex items-center space-x-1 text-gray-600">
                <span>Made with</span>
                <Heart className="h-4 w-4 text-red-500 heart-beat" />
                <span>by the ChronoTask team</span>
              </div>
              
              <div className="flex items-center space-x-6">
                <span className="text-gray-600">
                  © 2024 ChronoTask. All rights reserved.
                </span>
                <div className="flex space-x-4">
                  <a href="#terms" className="footer-link text-gray-600 hover:text-gray-900 text-sm">
                    Terms
                  </a>
                  <a href="#privacy" className="footer-link text-gray-600 hover:text-gray-900 text-sm">
                    Privacy
                  </a>
                  <a href="#cookies" className="footer-link text-gray-600 hover:text-gray-900 text-sm">
                    Cookies
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Decorative Elements */}
        <div className="absolute bottom-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 overflow-x-hidden"></div>
      </footer>
    </>
  );
};
