"use client";
import React from 'react';
import Link from 'next/link';

import { useAgentUi } from "@/features/agent/components/agent-ui-context";
import { McpConnectedLabel } from "@/features/agent/components/mcp-servers-card";
import { ModelPicker } from "@/features/agent/components/model-picker";

export default function AgentWorkflow() {
    const { openMcp } = useAgentUi();

    return (
        <div className="dark h-full w-full flex overflow-hidden text-sm bg-gray-950 text-gray-200 font-sans">
            {/* BEGIN: Left Sidebar */}
<aside className="w-64 bg-gray-900 border-r border-gray-800 flex flex-col flex-shrink-0" data-purpose="main-navigation">
{/* Logo Area */}
<div className="h-14 flex items-center px-4 shrink-0">
<div className="flex items-center gap-2 text-blue-500 font-bold text-xl tracking-tight">
<i className="fa-solid fa-cube"></i>
<span>fairlx</span>
</div>
</div>
{/* Scrollable Navigation */}
<div className="flex-1 overflow-y-auto custom-scrollbar px-3 py-4 flex flex-col gap-6">
{/* Actions & Search */}
<div className="flex flex-col gap-2">
<button className="w-full bg-blue-600 hover:bg-blue-500 text-white rounded-md py-2 px-3 flex items-center justify-between transition-colors">
<div className="flex items-center gap-2 font-medium">
<i className="fa-solid fa-plus text-xs"></i>
                        New Agent
                    </div>
<div className="flex items-center gap-1 opacity-70 text-xs">
<i className="fa-brands fa-apple"></i>K
                    </div>
</button>
<div className="relative">
<i className="fa-solid fa-magnifying-glass absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500 text-xs"></i>
<input className="w-full bg-gray-850 border border-gray-800 rounded-md py-1.5 pl-8 pr-12 text-gray-300 placeholder-gray-500 focus:outline-none focus:border-gray-700 text-sm" placeholder="Search" type="text"/>
<div className="absolute right-2 top-1/2 transform -translate-y-1/2 flex items-center gap-1 text-gray-500 text-xs">
<i className="fa-brands fa-apple"></i>K
                    </div>
</div>
</div>
{/* Main Menu */}
<nav className="flex flex-col gap-1">
<a className="flex items-center gap-3 px-2 py-2 rounded-md bg-gray-800 text-blue-400 font-medium" href="#">
<i className="fa-solid fa-house-chimney w-4 text-center"></i>
                    Agent Home
                </a>
<a className="flex items-center gap-3 px-2 py-2 rounded-md text-gray-400 hover:text-gray-200 hover:bg-gray-850 transition-colors" href="#">
<i className="fa-solid fa-folder w-4 text-center"></i>
                    Projects
                </a>
<a className="flex items-center gap-3 px-2 py-2 rounded-md text-gray-400 hover:text-gray-200 hover:bg-gray-850 transition-colors" href="#">
<i className="fa-solid fa-briefcase w-4 text-center"></i>
                    Workspaces
                </a>
<a className="flex items-center gap-3 px-2 py-2 rounded-md text-gray-400 hover:text-gray-200 hover:bg-gray-850 transition-colors" href="#">
<i className="fa-solid fa-wrench w-4 text-center"></i>
                    Skills
                </a>
<a className="flex items-center gap-3 px-2 py-2 rounded-md text-gray-400 hover:text-gray-200 hover:bg-gray-850 transition-colors" href="#">
<i className="fa-solid fa-screwdriver-wrench w-4 text-center"></i>
                    Tools
                </a>
<button type="button" onClick={openMcp} className="flex items-center gap-3 px-2 py-2 rounded-md text-gray-400 hover:text-gray-200 hover:bg-gray-850 transition-colors w-full text-left">
<i className="fa-solid fa-server w-4 text-center"></i>
                    MCP Servers
                </button>
<a className="flex items-center gap-3 px-2 py-2 rounded-md text-gray-400 hover:text-gray-200 hover:bg-gray-850 transition-colors" href="#">
<i className="fa-solid fa-bolt w-4 text-center"></i>
                    Automations
                </a>
<a className="flex items-center gap-3 px-2 py-2 rounded-md text-gray-400 hover:text-gray-200 hover:bg-gray-850 transition-colors" href="#">
<i className="fa-solid fa-book w-4 text-center"></i>
                    Knowledge Base
                </a>
<a className="flex items-center gap-3 px-2 py-2 rounded-md text-gray-400 hover:text-gray-200 hover:bg-gray-850 transition-colors" href="#">
<i className="fa-solid fa-puzzle-piece w-4 text-center"></i>
                    Integrations
                </a>
<a className="flex items-center gap-3 px-2 py-2 rounded-md text-gray-400 hover:text-gray-200 hover:bg-gray-850 transition-colors" href="#">
<i className="fa-solid fa-gear w-4 text-center"></i>
                    Settings
                </a>
</nav>
{/* Recent Work Items */}
<div className="mt-4">
<div className="flex items-center justify-between px-2 mb-2">
<h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Recent Work Items</h3>
<a className="text-blue-500 text-xs hover:underline" href="#">See all</a>
</div>
<div className="flex flex-col gap-1">
<a className="flex flex-col gap-1 px-2 py-2 rounded-md bg-gray-800 border border-gray-700" href="#">
<div className="flex items-center gap-2">
<i className="fa-regular fa-square-check text-blue-500 text-xs"></i>
<span className="font-medium text-gray-200 truncate">Create landing page hero</span>
</div>
<div className="flex items-center gap-1.5 pl-5 text-xs text-blue-400">
<span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span>
                            Running
                        </div>
</a>
<a className="flex flex-col gap-1 px-2 py-2 rounded-md hover:bg-gray-850 text-gray-400 transition-colors" href="#">
<div className="flex items-center gap-2">
<i className="fa-solid fa-bug text-xs"></i>
<span className="truncate">Fix login redirect issue</span>
</div>
<span className="pl-5 text-xs text-gray-500">2h ago</span>
</a>
<a className="flex flex-col gap-1 px-2 py-2 rounded-md hover:bg-gray-850 text-gray-400 transition-colors" href="#">
<div className="flex items-center gap-2">
<i className="fa-regular fa-file-pdf text-xs"></i>
<span className="truncate">Add PDF export</span>
</div>
<span className="pl-5 text-xs text-gray-500">5h ago</span>
</a>
<a className="flex flex-col gap-1 px-2 py-2 rounded-md hover:bg-gray-850 text-gray-400 transition-colors" href="#">
<div className="flex items-center gap-2">
<i className="fa-solid fa-code-merge text-xs"></i>
<span className="truncate">Refactor billing flow</span>
</div>
<span className="pl-5 text-xs text-gray-500">1d ago</span>
</a>
<a className="flex flex-col gap-1 px-2 py-2 rounded-md hover:bg-gray-850 text-gray-400 transition-colors" href="#">
<div className="flex items-center gap-2">
<i className="fa-solid fa-database text-xs"></i>
<span className="truncate">Optimize DB queries</span>
</div>
<span className="pl-5 text-xs text-gray-500">2d ago</span>
</a>
</div>
</div>
</div>
{/* User Profile Bottom */}
<div className="p-4 border-t border-gray-800 shrink-0">
<button className="w-full flex items-center justify-between p-2 rounded-md hover:bg-gray-800 border border-gray-800 bg-gray-850 transition-colors mb-2">
<div className="flex items-center gap-3">
<div className="w-8 h-8 rounded-full bg-gray-700 flex items-center justify-center text-gray-300 font-medium">
                        S
                    </div>
<div className="text-left">
<div className="font-medium text-gray-200">Surendra</div>
<div className="text-xs text-gray-500">Pro Plan</div>
</div>
</div>
<i className="fa-solid fa-chevron-down text-gray-500 text-xs"></i>
</button>
<button className="w-full flex items-center justify-center gap-2 p-2 rounded-md border border-gray-800 hover:bg-gray-800 text-gray-400 transition-colors text-xs">
<i className="fa-solid fa-user-plus"></i>
                Invite Members
            </button>
</div>
</aside>
{/* END: Left Sidebar */}
{/* BEGIN: Main Content Wrapper */}
<div className="flex-1 flex flex-col min-w-0 bg-gray-950">
{/* Header */}
<header className="h-14 border-b border-gray-800 flex items-center justify-between px-6 shrink-0 bg-gray-950 w-full">
<div className="flex items-center gap-2 text-sm text-gray-400">
<a className="hover:text-gray-200" href="#">Marketing Site</a>
<span className="text-gray-600">/</span>
<a className="hover:text-gray-200" href="#">marketing-website</a>
<span className="text-gray-600">/</span>
<span className="text-gray-200 font-medium">Create landing page hero section</span>
</div>
<div className="flex items-center gap-3">
<button className="flex items-center gap-2 px-3 py-1.5 rounded-md border border-gray-700 hover:bg-gray-800 text-gray-300 transition-colors text-xs font-medium">
<i className="fa-solid fa-arrow-up-right-from-square"></i> Share
                </button>
<button className="text-gray-400 hover:text-gray-200 relative">
<i className="fa-regular fa-bell text-lg"></i>
<span className="absolute top-0 right-0 w-2 h-2 bg-blue-500 rounded-full border border-gray-950"></span>
</button>
<div className="w-8 h-8 rounded-full bg-gray-700 flex items-center justify-center text-gray-300 font-medium cursor-pointer border border-gray-600">
                    S
                </div>
</div>
</header>
{/* Chat and Context Panel Wrapper */}
<div className="flex-1 flex overflow-hidden">
{/* BEGIN: Main Content Area */}
<main className="flex-1 flex flex-col min-w-0 bg-gray-950 relative" data-purpose="main-chat-area">
{/* Chat History (Scrollable) */}
<div className="flex-1 overflow-y-auto custom-scrollbar px-6 py-6 pb-32">
<div className="max-w-4xl mx-auto flex flex-col gap-8">
{/* Agent Header */}
<div className="flex items-center justify-between">
<div>
<div className="flex items-center gap-3 mb-1">
<h1 className="text-2xl font-semibold text-gray-100">Create landing page hero section</h1>
<button className="text-gray-500 hover:text-gray-300"><i className="fa-solid fa-pen text-sm"></i></button>
</div>
<div className="flex items-center gap-2 text-sm text-gray-400">
<span className="w-2 h-2 rounded-full bg-blue-500"></span>
<span className="text-blue-400 font-medium">Agent is running</span>
<span>•</span>
<span>Started 2m ago</span>
</div>
</div>
<button className="flex items-center gap-2 px-4 py-2 rounded-md border border-gray-700 hover:bg-gray-800 text-gray-300 transition-colors text-sm font-medium bg-gray-900">
<i className="fa-solid fa-stop"></i> Stop
                    </button>
</div>
{/* User Message */}
<div className="flex gap-4 justify-end">
<div className="bg-gray-900 border border-gray-800 rounded-lg p-4 max-w-2xl text-gray-300 relative group">
<div className="text-xs text-gray-500 mb-1 flex justify-between items-center">
<span>You <span className="mx-1">•</span> 11:32 PM</span>
</div>
<p className="leading-relaxed">Create a responsive hero section for the marketing site with a bold headline, subheadline, primary CTA button, and a subtle gradient background.</p>
<button className="absolute bottom-2 right-2 text-gray-600 hover:text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity">
<i className="fa-solid fa-pen text-xs"></i>
</button>
</div>
</div>
{/* Agent Response */}
<div className="flex gap-4">
<div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-white font-medium shrink-0 mt-1">
                        f
                    </div>
<div className="flex-1 flex flex-col gap-3">
<div className="text-xs text-gray-500 flex items-center gap-2">
<span className="font-medium text-gray-300">fairlx Agent</span>
<span>•</span>
<span>11:32 PM</span>
</div>
<p className="text-gray-300 leading-relaxed max-w-3xl">
                            Got it! I'll create a responsive hero section with a bold headline, subheadline, primary CTA button, and a subtle gradient background.
                        </p>
{/* Progress Card */}
<div className="bg-gray-900 border border-gray-800 rounded-lg overflow-hidden max-w-4xl mt-2">
{/* Progress Header */}
<div className="px-4 py-3 border-b border-gray-800 flex items-center justify-between">
<div className="flex items-center gap-3">
<i className="fa-solid fa-circle-notch fa-spin text-gray-400"></i>
<span className="font-medium text-gray-200">Working on it...</span>
</div>
<div className="flex items-center gap-3 text-xs text-gray-400">
<span>5 steps</span>
<i className="fa-solid fa-chevron-up"></i>
</div>
</div>
{/* Steps List */}
<div className="flex flex-col">
{/* Step 1 */}
<div className="px-4 py-3 border-b border-gray-800 flex items-start gap-4">
<div className="mt-0.5 text-green-500"><i className="fa-solid fa-check"></i></div>
<div className="flex-1">
<div className="font-medium text-gray-200">Analyzing requirements</div>
<div className="text-xs text-gray-500 mt-0.5">Understanding the request and planning the structure</div>
</div>
<div className="flex items-center gap-2 text-xs">
<span className="text-green-500"><i className="fa-regular fa-circle-check"></i> Completed</span>
<span className="text-gray-500 w-8 text-right">20s</span>
</div>
</div>
{/* Step 2 */}
<div className="px-4 py-3 border-b border-gray-800 flex items-start gap-4">
<div className="mt-0.5 text-green-500"><i className="fa-solid fa-check"></i></div>
<div className="flex-1">
<div className="font-medium text-gray-200">Searching existing components</div>
<div className="text-xs text-gray-500 mt-0.5">Looking for reusable UI components</div>
</div>
<div className="flex items-center gap-2 text-xs">
<span className="text-green-500"><i className="fa-regular fa-circle-check"></i> Completed</span>
<span className="text-gray-500 w-8 text-right">35s</span>
</div>
</div>
{/* Step 3 (Active) */}
<div className="px-4 py-3 border-b border-gray-800 flex items-start gap-4 bg-gray-850 relative before:absolute before:left-0 before:top-0 before:bottom-0 before:w-0.5 before:bg-blue-500">
<div className="mt-0.5 font-mono text-blue-500">3</div>
<div className="flex-1">
<div className="font-medium text-blue-400">Generating hero section</div>
<div className="text-xs text-gray-500 mt-0.5">Creating responsive hero section with gradient background</div>
</div>
<div className="flex items-center gap-2 text-xs">
<span className="text-blue-400 flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse"></span> In progress</span>
<span className="text-gray-400 w-12 text-right">1m 12s</span>
</div>
</div>
{/* Step 4 */}
<div className="px-4 py-3 border-b border-gray-800 flex items-start gap-4 opacity-50">
<div className="mt-0.5 font-mono text-gray-500">4</div>
<div className="flex-1">
<div className="font-medium text-gray-300">Adding animations &amp; responsiveness</div>
<div className="text-xs text-gray-500 mt-0.5">Applying animations and mobile styles</div>
</div>
<div className="flex items-center gap-2 text-xs text-gray-500">
<i className="fa-regular fa-circle"></i> Pending
                                    </div>
</div>
{/* Step 5 */}
<div className="px-4 py-3 flex items-start gap-4 opacity-50">
<div className="mt-0.5 font-mono text-gray-500">5</div>
<div className="flex-1">
<div className="font-medium text-gray-300">Finalizing and preparing preview</div>
<div className="text-xs text-gray-500 mt-0.5">Generating preview and summary</div>
</div>
<div className="flex items-center gap-2 text-xs text-gray-500">
<i className="fa-regular fa-circle"></i> Pending
                                    </div>
</div>
</div>
</div>
{/* Preview Area */}
<div className="border border-gray-800 rounded-lg overflow-hidden mt-4">
{/* Preview Tabs */}
<div className="flex items-center gap-1 border-b border-gray-800 px-2 py-1 bg-gray-900">
<button className="px-3 py-1.5 rounded-md bg-blue-500/10 text-blue-400 text-sm font-medium flex items-center gap-2">
<i className="fa-regular fa-eye"></i> Preview
                                </button>
<button className="px-3 py-1.5 rounded-md text-gray-400 hover:text-gray-200 hover:bg-gray-800 text-sm font-medium flex items-center gap-2 transition-colors">
<i className="fa-solid fa-code"></i> Code
                                </button>
<button className="px-3 py-1.5 rounded-md text-gray-400 hover:text-gray-200 hover:bg-gray-800 text-sm font-medium flex items-center gap-2 transition-colors">
<i className="fa-regular fa-file"></i> Files (2)
                                </button>
<button className="px-3 py-1.5 rounded-md text-gray-400 hover:text-gray-200 hover:bg-gray-800 text-sm font-medium flex items-center gap-2 transition-colors">
<i className="fa-regular fa-file-lines"></i> Logs
                                </button>
</div>
{/* Rendered Preview Content */}
<div className="p-8 bg-gray-950 flex items-center justify-center min-h-[300px] relative overflow-hidden">
{/* Gradient background effect for preview */}
<div className="absolute inset-0 bg-gradient-to-br from-blue-900/20 via-gray-900 to-purple-900/20 pointer-events-none"></div>
<div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl pointer-events-none"></div>
<div className="relative z-10 text-center max-w-2xl">
<h2 className="text-4xl md:text-5xl font-bold text-white mb-6 tracking-tight">Build better, together.</h2>
<p className="text-lg text-gray-400 mb-8 max-w-xl mx-auto leading-relaxed">
                                        The platform for modern teams to ship faster, collaborate smarter, and scale effortlessly.
                                    </p>
<div className="flex items-center justify-center gap-4">
<button className="px-6 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-md font-medium transition-colors">
                                            Get Started
                                        </button>
<button className="px-6 py-2.5 text-gray-300 hover:text-white font-medium transition-colors flex items-center gap-2">
                                            Learn more <i className="fa-solid fa-arrow-right text-sm"></i>
</button>
</div>
</div>
</div>
</div>
</div>
</div>
</div>
</div>
{/* Input Area (Fixed Bottom) */}
<div className="p-6 pt-0 bg-gradient-to-t from-gray-950 via-gray-950 to-transparent shrink-0 max-w-4xl w-full mx-auto relative z-20">
<div className="bg-gray-900 border border-gray-700 rounded-xl shadow-lg flex flex-col focus-within:border-gray-500 transition-colors">
<textarea className="w-full bg-transparent text-gray-200 p-4 pb-2 resize-none focus:outline-none placeholder-gray-500" placeholder="Ask anything, @ for context, / for commands" rows={1}></textarea>
<div className="flex items-center justify-between p-3 pt-2">
<div className="flex items-center gap-2">
<button className="w-8 h-8 rounded-md hover:bg-gray-800 text-gray-400 flex items-center justify-center transition-colors">
<i className="fa-solid fa-plus"></i>
</button>
<button className="px-3 py-1.5 rounded-md hover:bg-gray-800 border border-gray-800 text-gray-400 flex items-center gap-2 text-xs font-medium transition-colors">
<i className="fa-solid fa-at"></i> Context
                        </button>
<button className="px-3 py-1.5 rounded-md hover:bg-gray-800 border border-gray-800 text-gray-400 flex items-center gap-2 text-xs font-medium transition-colors">
<i className="fa-solid fa-wrench"></i> Tools
                        </button>
</div>
<div className="flex items-center gap-2">
<ModelPicker variant="chip" />
<button className="w-8 h-8 rounded-md bg-blue-600 hover:bg-blue-500 text-white flex items-center justify-center transition-colors shadow-sm">
<i className="fa-regular fa-paper-plane text-xs"></i>
</button>
</div>
</div>
</div>
</div>
</main>
{/* END: Main Content Area */}
{/* BEGIN: Right Sidebar */}
<aside className="w-72 bg-gray-900 border-l border-gray-800 flex flex-col flex-shrink-0" data-purpose="context-panel">
{/* Tabs */}
<div className="flex border-b border-gray-800 shrink-0">
<button className="flex-1 py-3 text-sm font-medium text-blue-400 border-b-2 border-blue-500 bg-gray-850">Context</button>
<button className="flex-1 py-3 text-sm font-medium text-gray-500 hover:text-gray-300 transition-colors">Files (2)</button>
<button className="flex-1 py-3 text-sm font-medium text-gray-500 hover:text-gray-300 transition-colors">Notes</button>
</div>
{/* Scrollable Content */}
<div className="flex-1 overflow-y-auto custom-scrollbar p-5 flex flex-col gap-6">
{/* Workspace & Project Info */}
<div className="flex flex-col gap-4">
<div>
<div className="text-xs text-gray-500 mb-2">Workspace</div>
<div className="flex items-center justify-between p-2 rounded-md hover:bg-gray-850 cursor-pointer border border-transparent hover:border-gray-800 group transition-colors">
<div className="flex items-center gap-2">
<i className="fa-solid fa-globe text-green-500"></i>
<span className="text-gray-300 text-sm group-hover:text-gray-200">Marketing Site</span>
</div>
<i className="fa-solid fa-chevron-right text-gray-600 text-xs group-hover:text-gray-400"></i>
</div>
</div>
<div>
<div className="text-xs text-gray-500 mb-2">Project</div>
<div className="flex items-center justify-between p-2 rounded-md hover:bg-gray-850 cursor-pointer border border-transparent hover:border-gray-800 group transition-colors">
<div className="flex items-center gap-2">
<i className="fa-solid fa-code text-blue-500"></i>
<span className="text-gray-300 text-sm group-hover:text-gray-200">marketing-website</span>
</div>
<i className="fa-solid fa-chevron-right text-gray-600 text-xs group-hover:text-gray-400"></i>
</div>
</div>
<div>
<div className="text-xs text-gray-500 mb-2">Agent</div>
<ModelPicker variant="sidebar" />
</div>
<div>
<button type="button" onClick={openMcp} className="w-full flex items-center justify-between p-2 rounded-md hover:bg-gray-850 cursor-pointer border border-transparent hover:border-gray-800 group transition-colors text-left">
<div className="flex items-center gap-2">
<i className="fa-solid fa-server text-gray-400"></i>
<span className="text-gray-300 text-sm group-hover:text-gray-200">MCP Servers</span>
</div>
<div className="flex items-center gap-2 text-xs">
<McpConnectedLabel className="text-green-500" />
<i className="fa-solid fa-chevron-right text-gray-600 group-hover:text-gray-400"></i>
</div>
</button>
</div>
</div>
<hr className="border-gray-800"/>
{/* Live Activity */}
<div>
<div className="flex items-center justify-between mb-4">
<h3 className="text-sm font-semibold text-gray-300">Live Activity</h3>
<div className="flex items-center gap-1.5 text-xs text-green-500 bg-green-500/10 px-2 py-0.5 rounded-full">
<span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></span>
                        Live
                    </div>
</div>
<div className="relative pl-3 border-l border-gray-800 flex flex-col gap-3">
<div className="relative">
<div className="absolute -left-[17px] top-1.5 w-2 h-2 rounded-full bg-gray-600"></div>
<div className="flex items-center justify-between text-xs">
<span className="text-gray-500">11:32:10</span>
<span className="text-gray-400 flex-1 ml-4">Agent started</span>
</div>
</div>
<div className="relative">
<div className="absolute -left-[17px] top-1.5 w-2 h-2 rounded-full bg-gray-600"></div>
<div className="flex items-center justify-between text-xs">
<span className="text-gray-500">11:32:12</span>
<span className="text-gray-400 flex-1 ml-4">Analyzing requirements</span>
</div>
</div>
<div className="relative">
<div className="absolute -left-[17px] top-1.5 w-2 h-2 rounded-full bg-gray-600"></div>
<div className="flex items-center justify-between text-xs">
<span className="text-gray-500">11:32:32</span>
<span className="text-gray-400 flex-1 ml-4">Searching components</span>
</div>
</div>
<div className="relative">
<div className="absolute -left-[17px] top-1.5 w-2 h-2 rounded-full bg-blue-500 shadow-[0_0_5px_rgba(59,130,246,0.5)]"></div>
<div className="flex items-center justify-between text-xs">
<span className="text-blue-400">11:33:07</span>
<span className="text-blue-400 font-medium flex-1 ml-4">Generating hero section</span>
</div>
</div>
<div className="relative opacity-50">
<div className="absolute -left-[17px] top-1.5 w-2 h-2 rounded-full border border-gray-600 bg-gray-900"></div>
<div className="flex items-center justify-between text-xs">
<span className="text-gray-500">11:33:44</span>
<span className="text-gray-500 flex-1 ml-4">Adding animations</span>
</div>
</div>
<div className="relative opacity-50">
<div className="absolute -left-[17px] top-1.5 w-2 h-2 rounded-full border border-gray-600 bg-gray-900"></div>
<div className="flex items-center justify-between text-xs">
<span className="text-gray-500">11:34:10</span>
<span className="text-gray-500 flex-1 ml-4">Preparing preview</span>
</div>
</div>
</div>
</div>
<hr className="border-gray-800"/>
{/* Token Usage */}
<div>
<div className="flex items-center justify-between mb-4">
<h3 className="text-sm font-semibold text-gray-300">Token Usage</h3>
<a className="text-xs text-blue-400 hover:underline" href="#">View details</a>
</div>
<div className="bg-gray-950 border border-gray-800 rounded-lg p-4 flex items-center gap-4">
{/* Circular Progress (CSS based) */}
<div className="relative w-16 h-16 shrink-0">
<svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
<path className="text-gray-800" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="currentColor" strokeWidth="3"></path>
<path className="text-blue-500" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="currentColor" strokeDasharray="68, 100" strokeWidth="3"></path>
</svg>
<div className="absolute inset-0 flex items-center justify-center text-sm font-semibold text-gray-200">
                            68%
                        </div>
</div>
<div>
<div className="text-sm font-medium text-gray-200">6,842 <span className="text-gray-500 text-xs font-normal">/ 10,000</span></div>
<div className="text-xs text-gray-500 mt-1">Tokens used</div>
<div className="text-xs text-gray-600 mt-1">Resets in 3 days</div>
</div>
</div>
</div>
<hr className="border-gray-800"/>
{/* Run Settings */}
<div>
<div className="flex items-center justify-between mb-4 cursor-pointer group">
<h3 className="text-sm font-semibold text-gray-300">Run Settings</h3>
<i className="fa-solid fa-chevron-right text-gray-600 text-xs group-hover:text-gray-400"></i>
</div>
<div className="flex flex-col gap-3 text-xs">
<div className="flex justify-between">
<span className="text-gray-500">Model</span>
<span className="text-gray-300">Claude 3.5 Sonnet</span>
</div>
<div className="flex justify-between">
<span className="text-gray-500">Temperature</span>
<span className="text-gray-300">0.3</span>
</div>
<div className="flex justify-between">
<span className="text-gray-500">Max Tokens</span>
<span className="text-gray-300">4,000</span>
</div>
<div className="flex justify-between">
<span className="text-gray-500">Permissions</span>
<span className="text-gray-300">Workspace</span>
</div>
</div>
</div>
</div>
</aside>
{/* END: Right Sidebar */}
</div>
{/* END: Chat and Context Panel Wrapper */}
</div>
{/* END: Main Content Wrapper */}
        </div>
    );
}
