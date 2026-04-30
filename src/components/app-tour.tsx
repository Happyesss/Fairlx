"use client";

import React, { useEffect, useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
    notifyTourChanged,
    IS_TOUR_ACTIVE_KEY
} from "@/lib/tour-dummy-data";
import { 
    Rocket, 
    Play, 
    X, 
    ChevronRight, 
    ChevronLeft, 
    Sparkles, 
    Gift,
    LayoutDashboard,
    ListTodo,
    Users,
    FolderKanban,
    Calendar
} from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useWorkspaceId } from "@/features/workspaces/hooks/use-workspace-id";
import { useAccountLifecycle } from "./account-lifecycle-provider";
import { ResponsiveModal } from "@/components/responsive-modal";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { TRIAL_CREDIT_USD } from "@/config";

// ============================================================================
// TYPES & STEPS
// ============================================================================

interface TourStep {
    id: string;
    selector: string;
    title: string;
    description: string;
    icon: React.ReactNode;
    position: "right" | "left" | "top" | "bottom";
    path?: string; // Optional path to navigate to before showing the step
}

const TOUR_STEPS: TourStep[] = [
    {
        id: "nav",
        selector: "#sidebar",
        title: "The Command Center",
        description: "Your entire workspace navigation starts here. Switch between home, tasks, and analytics instantly.",
        icon: <LayoutDashboard className="w-6 h-6 text-blue-400" />,
        position: "right",
    },
    {
        id: "dashboard",
        selector: "#dashboard-analytics",
        title: "Home & Analytics",
        description: "Monitor your team's pulse with real-time analytics. Get instant insights into task progress and workload.",
        icon: <Sparkles className="w-6 h-6 text-amber-400" />,
        position: "top",
        path: "" 
    },
    {
        id: "projects",
        selector: "#sidebar-projects-list",
        title: "Strategic Projects",
        description: "Manage multiple initiatives. Click into 'Fairlx' to see detailed project progress, sprints, and docs.",
        icon: <FolderKanban className="w-6 h-6 text-blue-500" />,
        position: "right",
    },
    {
        id: "project-detail",
        selector: "#project-dashboard",
        title: "Project Insights",
        description: "Deep dive into specific projects. Track deadlines, manage project-scoped tasks, and integrate with GitHub.",
        icon: <Sparkles className="w-6 h-6 text-pink-400" />,
        position: "top",
        path: "/projects/p1?task-view=dashboard"
    },
    {
        id: "tasks",
        selector: "main",
        title: "Global Task Board",
        description: "Your execution hub. Manage, filter, and track every piece of work across all your projects.",
        icon: <ListTodo className="w-6 h-6 text-purple-400" />,
        position: "top",
        path: "/tasks?task-view=dashboard"
    },
    {
        id: "spaces",
        selector: "#sidebar-spaces-list",
        title: "Team Spaces",
        description: "Group your work by department or team. Each space keeps your team's focus sharp and organized.",
        icon: <Users className="w-6 h-6 text-indigo-400" />,
        position: "right",
    },
    {
        id: "timeline",
        selector: "main",
        title: "Visual Timeline",
        description: "Plan and visualize your work over time. Identify bottlenecks and dependencies at a single glance.",
        icon: <Calendar className="w-6 h-6 text-pink-400" />,
        position: "top",
        path: "/projects/p1?task-view=timeline"
    }
];

// ============================================================================
// COMPONENT
// ============================================================================

export const AppTour = () => {
    const { lifecycleState: state, isPersonal, lifecycleRouting } = useAccountLifecycle();
    const { activeOrgId } = state;
    const { trialCreditGranted } = lifecycleRouting;

    const queryClient = useQueryClient();
    const router = useRouter();
    const workspaceId = useWorkspaceId();

    const [isTourActive, setIsTourActive] = useState(false);
    const [currentStep, setCurrentStep] = useState(0);
    const [showInvitation, setShowInvitation] = useState(false);
    const [targetRect, setTargetRect] = useState<DOMRect | null>(null);

    const invitationTimerRef = useRef<NodeJS.Timeout | null>(null);

    // Initial check for tour eligibility
    useEffect(() => {
        const storageKey = activeOrgId ? `app_tour_completed_${activeOrgId}` : `app_tour_completed_personal`;
        const hasCompleted = localStorage.getItem(storageKey);

        if (!hasCompleted) {
            // Show invitation for both personal and org users on first dashboard load
            // (Org users get a slightly longer delay to avoid overlapping with Trial Reward popup)
            const delay = activeOrgId ? 5000 : 3000;
            invitationTimerRef.current = setTimeout(() => setShowInvitation(true), delay);
            return () => {
                if (invitationTimerRef.current) clearTimeout(invitationTimerRef.current);
            };
        }
    }, [activeOrgId, isPersonal]);

    // Expose global trigger
    useEffect(() => {
        const win = window as Window & { startAppTour?: () => void; isFairlxTourActive?: boolean };
        win.startAppTour = () => {
            if (invitationTimerRef.current) {
                clearTimeout(invitationTimerRef.current);
                invitationTimerRef.current = null;
            }
            
            // ENABLE DUMMY DATA
            win.isFairlxTourActive = true;
            localStorage.setItem("fairlx_tour_active", "true");
            notifyTourChanged();

            queryClient.refetchQueries({ queryKey: ["workspace-analytics"] });
            queryClient.refetchQueries({ queryKey: ["tasks"] });
            queryClient.refetchQueries({ queryKey: ["projects"] });
            queryClient.refetchQueries({ queryKey: ["spaces"] });
            queryClient.refetchQueries({ queryKey: ["workspaces"] });

            setIsTourActive(true);
            setCurrentStep(0);
            setShowInvitation(false);
        };
        
        return () => {
            win.startAppTour = undefined;
        };
    }, [queryClient]);

    // Handle navigation when step changes
    useEffect(() => {
        if (isTourActive && workspaceId) {
            const step = TOUR_STEPS[currentStep];
            if (step.path !== undefined) {
                const targetPath = `/workspaces/${workspaceId}${step.path}`;
                console.log("[Tour] Navigating to:", targetPath);
                router.push(targetPath);
            }
        }
    }, [currentStep, isTourActive, workspaceId, router]);

    // PRE-LOAD ONLY CURRENT AND NEXT TO SAVE MEMORY (Fixes Heap OOM)
    // STABILIZED DEPENDENCIES: Ensure array size remains constant (4 items)
    useEffect(() => {
        if (isTourActive && workspaceId) {
            const currentStepPath = TOUR_STEPS[currentStep]?.path;
            const nextStepPath = TOUR_STEPS[currentStep + 1]?.path;
            
            if (currentStepPath !== undefined) {
                router.prefetch(`/workspaces/${workspaceId}${currentStepPath}`);
            }
            if (nextStepPath !== undefined) {
                router.prefetch(`/workspaces/${workspaceId}${nextStepPath}`);
            }
        }
    }, [isTourActive, currentStep, workspaceId, router]);

    // ROBUST STATE CLEANUP: Ensure no "phantom" dummy data persists
    useEffect(() => {
        const checkStaleTour = () => {
            const active = localStorage.getItem(IS_TOUR_ACTIVE_KEY) === "true";
            setIsTourActive(active);
            
            const win = window as Window & { isFairlxTourActive?: boolean };
            if (active) {
                win.isFairlxTourActive = true;
            } else if (isTourActive) {
                console.log("[Tour] Detected stale tour state. Cleaning up...");
                localStorage.removeItem(IS_TOUR_ACTIVE_KEY);
                win.isFairlxTourActive = false;
                notifyTourChanged();
            }
        };

        checkStaleTour();
        const interval = setInterval(checkStaleTour, 5000);
        return () => clearInterval(interval);
    }, [isTourActive]);

    // Update target rect when step changes
    useEffect(() => {
        if (!isTourActive) {
            setTargetRect(null);
            return;
        }

        const updateRect = () => {
            const step = TOUR_STEPS[currentStep];
            if (!step) return;

            const element = document.querySelector(step.selector);
            
            if (element) {
                setTargetRect(element.getBoundingClientRect());
            } else {
                setTargetRect(null);
            }
        };

        updateRect();
        const intervals = [100, 300, 600, 1000, 2000];
        const timers = intervals.map(ms => setTimeout(updateRect, ms));

        window.addEventListener("resize", updateRect);
        window.addEventListener("scroll", updateRect, true);
        return () => {
            timers.forEach(t => clearTimeout(t));
            window.removeEventListener("resize", updateRect);
            window.removeEventListener("scroll", updateRect, true);
        };
    }, [isTourActive, currentStep]);

    const handleNext = () => {
        if (currentStep < TOUR_STEPS.length - 1) {
            setCurrentStep(currentStep + 1);
        } else {
            handleComplete();
        }
    };

    const handleBack = () => {
        if (currentStep > 0) {
            setCurrentStep(currentStep - 1);
        }
    };

    const handleComplete = () => {
        localStorage.removeItem(IS_TOUR_ACTIVE_KEY);
        (window as Window & { isFairlxTourActive?: boolean }).isFairlxTourActive = false;
        setIsTourActive(false);

        if (workspaceId) {
            router.push(`/workspaces/${workspaceId}`);
        }
        
        const storageKey = activeOrgId ? `app_tour_completed_${activeOrgId}` : `app_tour_completed_personal`;
        localStorage.setItem(storageKey, "true");

        setTimeout(() => {
            queryClient.clear();
            notifyTourChanged();
        }, 200);
    };

    if (!isTourActive && !showInvitation) return null;

    return (
        <>
            <ResponsiveModal open={showInvitation} onOpenChange={setShowInvitation} showCloseButton={false}>
                <div className="relative overflow-hidden p-8 text-center bg-gradient-to-br from-background to-secondary/30 rounded-3xl border border-border">
                    <motion.div
                        animate={{ 
                            y: [0, -10, 0],
                            rotate: [0, 5, -5, 0]
                        }}
                        transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
                        className="w-20 h-20 bg-primary/10 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-xl shadow-primary/5 border border-primary/20"
                    >
                        <Rocket className="w-10 h-10 text-primary" />
                    </motion.div>
                    
                    {trialCreditGranted && (
                        <motion.div
                            initial={{ opacity: 0, y: -10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-blue-500/10 border border-blue-500/20 mb-4"
                        >
                            <Gift className="w-4 h-4 text-blue-500" />
                            <span className="text-sm font-bold text-blue-600 uppercase tracking-wider">${TRIAL_CREDIT_USD} CREDIT GRANTED</span>
                        </motion.div>
                    )}

                    <h2 className="text-4xl font-extrabold tracking-tight mb-3 bg-clip-text text-transparent bg-gradient-to-br from-foreground to-foreground/70">
                        Explore Fairlx
                    </h2>
                    <div className="mb-8 space-y-3">
                        <p className="text-muted-foreground text-sm leading-relaxed">
                            We&apos;ve populated your dashboard with dummy data so you can explore Fairlx&apos;s power immediately. 
                            Claim your <strong>${TRIAL_CREDIT_USD} trial credit</strong> after the tour to start your own project!
                        </p>
                        {trialCreditGranted && (
                            <p className="text-blue-500/80 text-sm font-medium">
                                Valid for all AI compute, storage, and premium features.
                            </p>
                        )}
                    </div>

                    <div className="flex flex-col gap-4">
                        <Button 
                            onClick={() => (window as unknown as Window & { startAppTour: () => void }).startAppTour()} 
                            className="w-full h-14 text-xl font-bold rounded-2xl group relative overflow-hidden"
                        >
                            <span className="relative z-10 flex items-center justify-center gap-2">
                                <Play className="w-5 h-5 fill-current" />
                                Start Interactive Tour
                            </span>
                            <motion.div 
                                className="absolute inset-0 bg-gradient-to-r from-primary via-blue-500 to-primary"
                                animate={{ x: ["-100%", "100%"] }}
                                transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
                                style={{ opacity: 0.2 }}
                            />
                        </Button>
                        <button 
                            onClick={() => { setShowInvitation(false); handleComplete(); }} 
                            className="text-muted-foreground hover:text-foreground font-medium transition-colors"
                        >
                            I&apos;ll explore on my own
                        </button>
                    </div>
                </div>
            </ResponsiveModal>

            {/* Tour Overlay & Spotlight */}
            <AnimatePresence>
                {isTourActive && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[9999] pointer-events-none"
                    >
                        {/* SVG Mask for Spotlight */}
                        <svg className="w-full h-full">
                            <defs>
                                <mask id="spotlight-mask">
                                    <rect width="100%" height="100%" fill="white" />
                                    {targetRect && (
                                        <motion.rect
                                            layoutId="spotlight-hole"
                                            initial={false}
                                            animate={{
                                                x: targetRect.left - 10,
                                                y: targetRect.top - 10,
                                                width: targetRect.width + 20,
                                                height: targetRect.height + 20,
                                                rx: 16
                                            }}
                                            transition={{ type: "spring", damping: 25, stiffness: 200 }}
                                            fill="black"
                                        />
                                    )}
                                </mask>
                            </defs>
                            <rect width="100%" height="100%" fill="rgba(0, 0, 0, 0.75)" mask="url(#spotlight-mask)" className="pointer-events-auto" />
                        </svg>

                        {/* Animated Border for Spotlight */}
                        {targetRect && (
                            <motion.div
                                layoutId="spotlight-border"
                                initial={false}
                                animate={{
                                    left: targetRect.left - 12,
                                    top: targetRect.top - 12,
                                    width: targetRect.width + 24,
                                    height: targetRect.height + 24,
                                }}
                                transition={{ type: "spring", damping: 25, stiffness: 200 }}
                                className="fixed border-2 border-primary/50 rounded-[20px] shadow-[0_0_30px_rgba(var(--primary-rgb),0.3)] pointer-events-none"
                            >
                                <motion.div 
                                    animate={{ opacity: [0.2, 0.5, 0.2] }}
                                    transition={{ duration: 2, repeat: Infinity }}
                                    className="absolute inset-0 bg-primary/5 rounded-[20px]"
                                />
                            </motion.div>
                        )}

                        {/* Floating Content Card */}
                        <div className="fixed inset-0 flex items-center justify-center pointer-events-none">
                            {targetRect && (
                                <motion.div
                                    key={currentStep}
                                    initial={{ opacity: 0, scale: 0.9, y: 20 }}
                                    animate={{ 
                                        opacity: 1, 
                                        scale: 1, 
                                        y: 0,
                                        left: getCardPosition(targetRect, TOUR_STEPS[currentStep].position).left,
                                        top: getCardPosition(targetRect, TOUR_STEPS[currentStep].position).top,
                                    }}
                                    exit={{ opacity: 0, scale: 0.9, y: 20 }}
                                    transition={{ type: "spring", damping: 20, stiffness: 150 }}
                                    className="fixed pointer-events-auto w-[380px] bg-background/95 backdrop-blur-3xl border border-primary/20 p-7 rounded-[32px] shadow-[0_32px_64px_-16px_rgba(0,0,0,0.3)] z-[10000]"
                                >
                                    <div className="flex flex-col space-y-5">
                                        <div className="flex items-center justify-between">
                                            <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center">
                                                {TOUR_STEPS[currentStep].icon}
                                            </div>
                                            <div className="flex gap-1.5">
                                                {TOUR_STEPS.map((_, i) => (
                                                    <div 
                                                        key={i} 
                                                        className={cn(
                                                            "h-1.5 rounded-full transition-all duration-300",
                                                            i === currentStep ? "w-6 bg-primary" : "w-1.5 bg-border"
                                                        )}
                                                    />
                                                ))}
                                            </div>
                                        </div>

                                        <div className="space-y-3">
                                            <h3 className="text-2xl font-extrabold tracking-tight text-foreground">{TOUR_STEPS[currentStep].title}</h3>
                                            <p className="text-foreground/90 text-[17px] leading-relaxed font-medium">
                                                {TOUR_STEPS[currentStep].description}
                                            </p>
                                        </div>

                                        <div className="flex items-center justify-between pt-2">
                                            <button 
                                                onClick={handleBack}
                                                disabled={currentStep === 0}
                                                className="p-2 text-muted-foreground hover:text-foreground disabled:opacity-30 transition-colors"
                                            >
                                                <ChevronLeft className="w-6 h-6" />
                                            </button>

                                            <Button 
                                                onClick={handleNext}
                                                className="rounded-xl px-6 h-11 bg-primary hover:bg-primary/90 transition-all font-semibold"
                                            >
                                                {currentStep === TOUR_STEPS.length - 1 ? "Finish Tour" : "Next Step"}
                                                <ChevronRight className="w-4 h-4 ml-2" />
                                            </Button>
                                        </div>
                                    </div>

                                    {/* Close Button */}
                                    <button 
                                        onClick={handleComplete}
                                        className="absolute -top-3 -right-3 w-8 h-8 bg-background border border-border rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground shadow-lg"
                                    >
                                        <X className="w-4 h-4" />
                                    </button>
                                </motion.div>
                            )}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </>
    );
};

// ============================================================================
// HELPERS
// ============================================================================

function getCardPosition(rect: DOMRect, position: TourStep["position"]) {
    const margin = 32;
    const cardWidth = 380;
    const cardHeight = 280; // Approximate

    let left = 0;
    let top = 0;

    switch (position) {
        case "right":
            left = rect.right + margin;
            top = rect.top + (rect.height / 2) - (cardHeight / 2);
            break;
        case "left":
            left = rect.left - cardWidth - margin;
            top = rect.top + (rect.height / 2) - (cardHeight / 2);
            break;
        case "bottom":
            left = rect.left + (rect.width / 2) - (cardWidth / 2);
            top = rect.bottom + margin;
            break;
        case "top":
            left = rect.left + (rect.width / 2) - (cardWidth / 2);
            top = rect.top - cardHeight - margin;
            break;
    }

    // Guard rails to stay on screen
    left = Math.max(margin, Math.min(window.innerWidth - cardWidth - margin, left));
    top = Math.max(margin, Math.min(window.innerHeight - cardHeight - margin, top));

    return { left, top };
}
