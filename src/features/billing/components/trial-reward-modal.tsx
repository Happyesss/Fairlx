"use client";

import React, { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Gift, CheckCircle2, X } from "lucide-react";
import { ResponsiveModal } from "@/components/responsive-modal";
import { Button } from "@/components/ui/button";
import { TRIAL_CREDIT_USD, TRIAL_CREDIT_DAYS } from "@/config";

interface TrialRewardModalProps {
    orgId: string | null;
    trialCreditGranted: boolean;
}

export const TrialRewardModal = ({ orgId, trialCreditGranted }: TrialRewardModalProps) => {
    const [isOpen, setIsOpen] = useState(false);

    useEffect(() => {
        if (!orgId || !trialCreditGranted) return;

        // Check if we've already shown this modal for this organization
        const hasShown = localStorage.getItem(`trial_reward_shown_${orgId}`);
        
        if (!hasShown) {
            // Delay slightly for better UX (let the page load first)
            const timer = setTimeout(() => {
                setIsOpen(true);
            }, 1500);
            return () => clearTimeout(timer);
        }
    }, [orgId, trialCreditGranted]);

    const handleClose = () => {
        setIsOpen(false);
        if (orgId) {
            localStorage.setItem(`trial_reward_shown_${orgId}`, "true");
        }
        // Trigger the app tour after the reward modal closes
        const win = window as Window & { startAppTour?: () => void };
        if (win.startAppTour) {
            win.startAppTour();
        }
    };

    return (
        <ResponsiveModal open={isOpen} onOpenChange={setIsOpen} showCloseButton={false}>
            <div className="relative overflow-hidden bg-gradient-to-br from-blue-600 via-indigo-700 to-purple-800 p-8 text-white rounded-lg shadow-2xl">
                {/* Background Decorations */}
                <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none opacity-20">
                    <motion.div 
                        animate={{ 
                            scale: [1, 1.2, 1],
                            rotate: [0, 90, 0],
                        }}
                        transition={{ duration: 20, repeat: Infinity }}
                        className="absolute -top-20 -left-20 w-64 h-64 bg-white rounded-full blur-3xl"
                    />
                    <motion.div 
                        animate={{ 
                            scale: [1, 1.3, 1],
                            rotate: [0, -90, 0],
                        }}
                        transition={{ duration: 15, repeat: Infinity }}
                        className="absolute -bottom-20 -right-20 w-80 h-80 bg-blue-400 rounded-full blur-3xl"
                    />
                </div>

                <div className="relative z-10 flex flex-col items-center text-center space-y-6">
                    <motion.div
                        initial={{ scale: 0, rotate: -45 }}
                        animate={{ scale: 1, rotate: 0 }}
                        transition={{ type: "spring", damping: 12, stiffness: 100, delay: 0.2 }}
                        className="w-20 h-20 bg-white/20 backdrop-blur-md rounded-2xl flex items-center justify-center shadow-inner"
                    >
                        <Gift className="w-10 h-10 text-white" />
                    </motion.div>

                    <div className="space-y-2">
                        <motion.h2 
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.4 }}
                            className="text-3xl font-bold tracking-tight"
                        >
                            Trial Reward Credited!
                        </motion.h2>
                        <motion.p 
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.5 }}
                            className="text-blue-100 text-lg"
                        >
                            We&apos;ve credited your account with a special gift.
                        </motion.p>
                    </div>

                    <motion.div
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: 0.7, type: "spring" }}
                        className="bg-white/10 backdrop-blur-xl border border-white/20 rounded-3xl p-6 w-full max-w-sm flex flex-col items-center space-y-2"
                    >
                        <span className="text-blue-200 uppercase tracking-widest text-xs font-semibold">Reward Credited</span>
                        <div className="flex items-baseline gap-1">
                            <span className="text-5xl font-extrabold">${TRIAL_CREDIT_USD}</span>
                            <span className="text-xl font-medium text-blue-200">USD</span>
                        </div>
                        <div className="flex items-center gap-2 text-sm text-green-300 font-medium">
                            <CheckCircle2 className="w-4 h-4" />
                            <span>Valid for {TRIAL_CREDIT_DAYS} days</span>
                        </div>
                    </motion.div>

                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 1 }}
                        className="w-full pt-4"
                    >
                        <Button 
                            onClick={handleClose}
                            className="w-full h-12 bg-white text-blue-700 hover:bg-blue-50 font-bold text-lg rounded-xl transition-all hover:scale-[1.02] active:scale-[0.98] shadow-lg shadow-black/20"
                        >
                            Start Exploring
                        </Button>
                        <p className="mt-4 text-xs text-blue-200/60 italic">
                            Credits can be used for AI compute, storage, and premium features.
                        </p>
                    </motion.div>
                </div>

                <button 
                    onClick={handleClose}
                    className="absolute top-4 right-4 p-2 text-white/50 hover:text-white transition-colors rounded-full hover:bg-white/10"
                >
                    <X className="w-5 h-5" />
                </button>
            </div>
        </ResponsiveModal>
    );
};
