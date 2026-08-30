"use client";
import React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

import { useAgentUi } from "@/features/agent/components/agent-ui-context";
import { McpServersCard } from "@/features/agent/components/mcp-servers-card";
import { ModelPicker } from "@/features/agent/components/model-picker";

export default function AgentDashboard() {
    const router = useRouter();
    const { openMcp } = useAgentUi();

    return (
        <div className="dark bg-fairlx-bg text-fairlx-text font-sans antialiased h-full w-full flex overflow-hidden selection:bg-fairlx-primary selection:text-white">
            {/* BEGIN: Sidebar */}
<aside className="w-64 flex-shrink-0 bg-fairlx-surface border-r border-fairlx-border flex flex-col h-full z-20">
{/* Logo */}
<div className="h-16 flex items-center px-6 border-b border-fairlx-border">
<a className="flex items-center gap-2" href="#">
<span className="text-xl font-bold text-fairlx-primary tracking-tight">fairlx</span>
</a>
</div>
{/* Navigation */}
<div className="flex-1 overflow-y-auto scrollbar-hide py-4 px-3 flex flex-col gap-6">
<nav className="space-y-1">
<a className="flex items-center justify-between px-3 py-2 rounded-md bg-fairlx-primary/10 text-fairlx-primary group" href="#">
<div className="flex items-center gap-3">
<i className="fa-solid fa-house w-5 text-center"></i>
<span className="font-medium text-sm">Agent Home</span>
</div>
<span className="text-[10px] bg-fairlx-surface-hover border border-fairlx-border rounded px-1.5 py-0.5 text-fairlx-text-muted">⌘ H</span>
</a>
<a className="flex items-center px-3 py-2 rounded-md text-fairlx-text-muted hover:bg-fairlx-surface-hover hover:text-fairlx-text transition-colors group" href="#">
<i className="fa-regular fa-folder w-5 text-center"></i>
<span className="ml-3 font-medium text-sm">Projects</span>
</a>
<a className="flex items-center px-3 py-2 rounded-md text-fairlx-text-muted hover:bg-fairlx-surface-hover hover:text-fairlx-text transition-colors group" href="#">
<i className="fa-solid fa-border-all w-5 text-center"></i>
<span className="ml-3 font-medium text-sm">Workspaces</span>
</a>
<a className="flex items-center px-3 py-2 rounded-md text-fairlx-text-muted hover:bg-fairlx-surface-hover hover:text-fairlx-text transition-colors group" href="#">
<i className="fa-solid fa-bullseye w-5 text-center"></i>
<span className="ml-3 font-medium text-sm">Skills</span>
</a>
<a className="flex items-center px-3 py-2 rounded-md text-fairlx-text-muted hover:bg-fairlx-surface-hover hover:text-fairlx-text transition-colors group" href="#">
<i className="fa-solid fa-wrench w-5 text-center"></i>
<span className="ml-3 font-medium text-sm">Tools</span>
</a>
<button type="button" onClick={openMcp} className="flex items-center px-3 py-2 rounded-md text-fairlx-text-muted hover:bg-fairlx-surface-hover hover:text-fairlx-text transition-colors group w-full text-left">
<i className="fa-solid fa-server w-5 text-center"></i>
<span className="ml-3 font-medium text-sm">MCP Servers</span>
</button>
<a className="flex items-center px-3 py-2 rounded-md text-fairlx-text-muted hover:bg-fairlx-surface-hover hover:text-fairlx-text transition-colors group" href="#">
<i className="fa-solid fa-robot w-5 text-center"></i>
<span className="ml-3 font-medium text-sm">Automations</span>
</a>
<a className="flex items-center px-3 py-2 rounded-md text-fairlx-text-muted hover:bg-fairlx-surface-hover hover:text-fairlx-text transition-colors group" href="#">
<i className="fa-solid fa-puzzle-piece w-5 text-center"></i>
<span className="ml-3 font-medium text-sm">Integrations</span>
</a>
<a className="flex items-center px-3 py-2 rounded-md text-fairlx-text-muted hover:bg-fairlx-surface-hover hover:text-fairlx-text transition-colors group" href="#">
<i className="fa-solid fa-book w-5 text-center"></i>
<span className="ml-3 font-medium text-sm">Knowledge Base</span>
</a>
<a className="flex items-center px-3 py-2 rounded-md text-fairlx-text-muted hover:bg-fairlx-surface-hover hover:text-fairlx-text transition-colors group" href="#">
<i className="fa-solid fa-gear w-5 text-center"></i>
<span className="ml-3 font-medium text-sm">Settings</span>
</a>
</nav>
<div>
<div className="flex items-center justify-between px-3 mb-2">
<h3 className="text-xs font-semibold text-fairlx-text-muted uppercase tracking-wider">Recent Work Items</h3>
<a className="text-xs text-fairlx-primary hover:underline" href="#">See all</a>
</div>
<div className="space-y-1">
<a className="block px-3 py-2 rounded-md hover:bg-fairlx-surface-hover transition-colors group" href="#">
<div className="flex items-start gap-2">
<i className="fa-regular fa-square-check w-4 text-fairlx-text-muted mt-0.5 text-[10px]"></i>
<div>
<p className="text-sm font-medium text-fairlx-text group-hover:text-white truncate">Fix login redirect issue</p>
<p className="text-xs text-fairlx-text-muted">2m ago</p>
</div>
</div>
</a>
<a className="block px-3 py-2 rounded-md hover:bg-fairlx-surface-hover transition-colors group" href="#">
<div className="flex items-start gap-2">
<i className="fa-regular fa-clock w-4 text-fairlx-text-muted mt-0.5 text-[10px]"></i>
<div>
<p className="text-sm font-medium text-fairlx-text group-hover:text-white truncate">Add PDF export</p>
<p className="text-xs text-fairlx-text-muted">1h ago</p>
</div>
</div>
</a>
<a className="block px-3 py-2 rounded-md hover:bg-fairlx-surface-hover transition-colors group" href="#">
<div className="flex items-start gap-2">
<i className="fa-solid fa-code-commit w-4 text-fairlx-text-muted mt-0.5 text-[10px]"></i>
<div>
<p className="text-sm font-medium text-fairlx-text group-hover:text-white truncate">Refactor billing flow</p>
<p className="text-xs text-fairlx-text-muted">3h ago</p>
</div>
</div>
</a>
<a className="block px-3 py-2 rounded-md hover:bg-fairlx-surface-hover transition-colors group" href="#">
<div className="flex items-start gap-2">
<i className="fa-solid fa-chart-line w-4 text-fairlx-text-muted mt-0.5 text-[10px]"></i>
<div>
<p className="text-sm font-medium text-fairlx-text group-hover:text-white truncate">Update dashboard charts</p>
<p className="text-xs text-fairlx-text-muted">5h ago</p>
</div>
</div>
</a>
<a className="block px-3 py-2 rounded-md hover:bg-fairlx-surface-hover transition-colors group" href="#">
<div className="flex items-start gap-2">
<i className="fa-solid fa-database w-4 text-fairlx-text-muted mt-0.5 text-[10px]"></i>
<div>
<p className="text-sm font-medium text-fairlx-text group-hover:text-white truncate">Optimize DB queries</p>
<p className="text-xs text-fairlx-text-muted">1d ago</p>
</div>
</div>
</a>
</div>
</div>
</div>
{/* User Profile Footer */}
<div className="p-4 border-t border-fairlx-border space-y-3">
<button className="w-full flex items-center justify-between p-2 rounded-lg hover:bg-fairlx-surface-hover border border-transparent hover:border-fairlx-border transition-colors group">
<div className="flex items-center gap-3">
<div className="w-8 h-8 rounded-full bg-gray-700 flex items-center justify-center text-sm font-medium text-white">S</div>
<div className="text-left">
<p className="text-sm font-medium text-fairlx-text group-hover:text-white">Surendra</p>
<p className="text-xs text-fairlx-text-muted">Pro Plan</p>
</div>
</div>
<i className="fa-solid fa-chevron-down text-xs text-fairlx-text-muted"></i>
</button>
<button className="w-full flex items-center justify-center gap-2 py-2 px-4 rounded-lg border border-fairlx-border hover:bg-fairlx-surface-hover text-sm font-medium transition-colors text-fairlx-text">
<i className="fa-regular fa-user text-fairlx-text-muted"></i>
            Invite Members
        </button>
</div>
</aside>
{/* END: Sidebar */}
{/* BEGIN: Main Content Area */}
<div className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
{/* Topbar */}
<header className="h-16 flex items-center justify-between px-8 border-b border-fairlx-border/50 bg-fairlx-bg/80 backdrop-blur-sm sticky top-0 z-10">
{/* Mode Switcher */}
<div className="flex items-center bg-fairlx-surface rounded-lg p-1 border border-fairlx-border">
<button className="flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium text-fairlx-text-muted hover:text-fairlx-text transition-colors">
<i className="fa-solid fa-grip text-xs"></i>
          Manual Mode
        </button>
<button className="flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium bg-fairlx-primary/10 text-fairlx-primary shadow-sm border border-fairlx-primary/20">
<i className="fa-solid fa-wand-magic-sparkles text-xs"></i>
          Agent Mode
        </button>
</div>
{/* Right Actions */}
<div className="flex items-center gap-4">
<button className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-fairlx-surface border border-fairlx-border text-fairlx-text-muted text-sm hover:bg-fairlx-surface-hover transition-colors">
<i className="fa-regular fa-keyboard"></i>
<span className="text-xs border border-fairlx-border rounded px-1">K</span>
</button>
<button className="text-fairlx-text-muted hover:text-fairlx-text transition-colors relative">
<i className="fa-regular fa-bell text-lg"></i>
<span className="absolute top-0 right-0 w-2 h-2 bg-fairlx-primary rounded-full border border-fairlx-bg"></span>
</button>
<button className="flex items-center gap-2">
<div className="w-8 h-8 rounded-full bg-gray-700 flex items-center justify-center text-sm font-medium text-white border border-fairlx-border">S</div>
<i className="fa-solid fa-chevron-down text-xs text-fairlx-text-muted"></i>
</button>
</div>
</header>
{/* Main Scrollable Content */}
<main className="flex-1 overflow-y-auto p-8 scrollbar-hide">
<div className="max-w-[1400px] mx-auto grid grid-cols-1 lg:grid-cols-3 gap-8">
{/* Center/Left Column (Takes up 2/3 space on large screens) */}
<div className="lg:col-span-2 space-y-10">
{/* Hero Section */}
<section>
<h1 className="text-3xl font-semibold text-white tracking-tight mb-2">Good evening, Surendra 👋</h1>
<p className="text-fairlx-text-muted text-lg mb-6">What shall we build today?</p>
{/* Search/Command Input */}
<form onSubmit={(e) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const query = formData.get('query');
    if (query?.toString().toLowerCase() === 'hi') {
        router.push('/agent/workflow');
    }
}} className="bg-fairlx-surface border border-fairlx-border rounded-xl p-4 shadow-sm focus-within:border-fairlx-primary/50 transition-colors">
<div className="relative flex items-center mb-4">
<input name="query" className="w-full bg-transparent border-none text-lg text-white placeholder-fairlx-text-muted focus:ring-0 px-2 py-1" placeholder="Plan, build, iterate... @ for context, / for commands" type="text"/>
</div>
<div className="flex items-center justify-between">
<div className="flex items-center gap-2">
<button type="button" className="w-8 h-8 rounded-md bg-fairlx-surface-hover border border-fairlx-border flex items-center justify-center text-fairlx-text-muted hover:text-white transition-colors">
<i className="fa-solid fa-plus text-sm"></i>
</button>
<button type="button" className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-fairlx-surface-hover border border-fairlx-border text-sm text-fairlx-text-muted hover:text-white transition-colors">
<i className="fa-solid fa-at"></i>
                    Context
                  </button>
<button type="button" className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-fairlx-surface-hover border border-fairlx-border text-sm text-fairlx-text-muted hover:text-white transition-colors">
<i className="fa-solid fa-wrench"></i>
                    Tools
                  </button>
<ModelPicker variant="chip" />
</div>
<button type="submit" className="w-8 h-8 rounded-md bg-fairlx-primary hover:bg-fairlx-primary-hover flex items-center justify-center text-white transition-colors shadow-sm">
<i className="fa-regular fa-paper-plane text-sm"></i>
</button>
</div>
</form>
{/* Quick Actions */}
<div className="flex flex-wrap items-center gap-3 mt-4">
<button className="flex items-center gap-2 px-4 py-2 rounded-full border border-fairlx-border bg-fairlx-surface hover:bg-fairlx-surface-hover text-sm font-medium text-fairlx-text transition-colors">
<i className="fa-solid fa-sparkles text-fairlx-warning text-xs"></i>
                Plan new feature
              </button>
<button className="flex items-center gap-2 px-4 py-2 rounded-full border border-fairlx-border bg-fairlx-surface hover:bg-fairlx-surface-hover text-sm font-medium text-fairlx-text transition-colors">
<i className="fa-solid fa-bug text-fairlx-danger text-xs"></i>
                Fix a bug
              </button>
<button className="flex items-center gap-2 px-4 py-2 rounded-full border border-fairlx-border bg-fairlx-surface hover:bg-fairlx-surface-hover text-sm font-medium text-fairlx-text transition-colors">
<i className="fa-solid fa-rotate text-fairlx-primary text-xs"></i>
                Refactor code
              </button>
<button className="flex items-center gap-2 px-4 py-2 rounded-full border border-fairlx-border bg-fairlx-surface hover:bg-fairlx-surface-hover text-sm font-medium text-fairlx-text transition-colors">
<i className="fa-solid fa-flask text-purple-400 text-xs"></i>
                Write tests
              </button>
<button className="flex items-center gap-2 px-4 py-2 rounded-full border border-fairlx-border bg-fairlx-surface hover:bg-fairlx-surface-hover text-sm font-medium text-fairlx-text transition-colors">
<i className="fa-regular fa-file-lines text-fairlx-warning text-xs"></i>
                Add docs
              </button>
</div>
</section>
{/* Workspaces Section */}
<section>
<div className="flex items-center justify-between mb-4">
<h2 className="text-lg font-semibold text-white">Workspaces</h2>
<a className="text-sm text-fairlx-text-muted hover:text-white transition-colors" href="#">View all</a>
</div>
<div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
{/* Workspace Card: Projects */}
<a className="group block p-5 rounded-xl bg-fairlx-surface border border-fairlx-border hover:border-fairlx-primary/50 transition-all hover:-translate-y-1 hover:shadow-lg hover:shadow-fairlx-primary/5" href="#">
<div className="w-10 h-10 rounded-lg bg-blue-500/20 flex items-center justify-center mb-4 text-blue-500 group-hover:scale-110 transition-transform">
<i className="fa-solid fa-folder text-lg"></i>
</div>
<h3 className="font-semibold text-white mb-1">Projects</h3>
<p className="text-sm text-fairlx-text-muted mb-6 line-clamp-2">All development projects and codebases</p>
<div className="flex items-center justify-between mt-auto">
<span className="text-xs font-medium text-fairlx-text-muted">12 Projects</span>
<div className="w-6 h-6 rounded-full bg-fairlx-surface-hover flex items-center justify-center text-fairlx-text-muted group-hover:bg-fairlx-primary group-hover:text-white transition-colors">
<i className="fa-solid fa-arrow-right text-[10px]"></i>
</div>
</div>
</a>
{/* Workspace Card: Design System */}
<a className="group block p-5 rounded-xl bg-fairlx-surface border border-fairlx-border hover:border-purple-500/50 transition-all hover:-translate-y-1 hover:shadow-lg hover:shadow-purple-500/5" href="#">
<div className="w-10 h-10 rounded-lg bg-purple-500/20 flex items-center justify-center mb-4 text-purple-500 group-hover:scale-110 transition-transform">
<i className="fa-solid fa-pen-nib text-lg"></i>
</div>
<h3 className="font-semibold text-white mb-1">Design System</h3>
<p className="text-sm text-fairlx-text-muted mb-6 line-clamp-2">UI components, tokens and design assets</p>
<div className="flex items-center justify-between mt-auto">
<span className="text-xs font-medium text-fairlx-text-muted">8 Projects</span>
<div className="w-6 h-6 rounded-full bg-fairlx-surface-hover flex items-center justify-center text-fairlx-text-muted group-hover:bg-purple-500 group-hover:text-white transition-colors">
<i className="fa-solid fa-arrow-right text-[10px]"></i>
</div>
</div>
</a>
{/* Workspace Card: Marketing Site */}
<a className="group block p-5 rounded-xl bg-fairlx-surface border border-fairlx-border hover:border-green-500/50 transition-all hover:-translate-y-1 hover:shadow-lg hover:shadow-green-500/5" href="#">
<div className="w-10 h-10 rounded-lg bg-green-500/20 flex items-center justify-center mb-4 text-green-500 group-hover:scale-110 transition-transform">
<i className="fa-solid fa-globe text-lg"></i>
</div>
<h3 className="font-semibold text-white mb-1">Marketing Site</h3>
<p className="text-sm text-fairlx-text-muted mb-6 line-clamp-2">Website, landing pages and marketing assets</p>
<div className="flex items-center justify-between mt-auto">
<span className="text-xs font-medium text-fairlx-text-muted">5 Projects</span>
<div className="w-6 h-6 rounded-full bg-fairlx-surface-hover flex items-center justify-center text-fairlx-text-muted group-hover:bg-green-500 group-hover:text-white transition-colors">
<i className="fa-solid fa-arrow-right text-[10px]"></i>
</div>
</div>
</a>
{/* New Workspace Action */}
<button className="group block p-5 rounded-xl border border-dashed border-fairlx-border hover:border-fairlx-text-muted hover:bg-fairlx-surface/50 transition-all flex flex-col items-center justify-center text-center h-full min-h-[180px]">
<div className="w-10 h-10 rounded-full bg-fairlx-surface border border-fairlx-border flex items-center justify-center mb-3 text-fairlx-text-muted group-hover:text-white group-hover:border-fairlx-text-muted transition-colors">
<i className="fa-solid fa-plus"></i>
</div>
<h3 className="font-medium text-white mb-1">New Workspace</h3>
<p className="text-xs text-fairlx-text-muted">Create a new workspace</p>
</button>
</div>
</section>
{/* Recent Projects Section */}
<section>
<div className="flex items-center justify-between mb-4">
<h2 className="text-lg font-semibold text-white">Recent Projects</h2>
<a className="text-sm text-fairlx-text-muted hover:text-white transition-colors" href="#">View all projects</a>
</div>
<div className="bg-fairlx-surface border border-fairlx-border rounded-xl overflow-hidden">
<div className="divide-y divide-fairlx-border">
{/* Project Row 1 */}
<div className="p-4 flex items-center justify-between hover:bg-fairlx-surface-hover transition-colors group">
<div className="flex items-center gap-4">
<div className="w-10 h-10 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-500">
<i className="fa-solid fa-code text-lg"></i>
</div>
<div>
<h4 className="text-sm font-semibold text-white mb-0.5">fairlx-platform</h4>
<div className="flex items-center gap-2 text-xs text-fairlx-text-muted">
<span className="flex items-center gap-1"><i className="fa-brands fa-github text-[10px]"></i> Main</span>
<span>•</span>
<span>Updated 10m ago</span>
</div>
</div>
</div>
<div className="flex items-center gap-4">
<span className="px-2 py-0.5 rounded text-[10px] font-medium bg-green-500/10 text-green-500 border border-green-500/20">Active</span>
<button className="px-3 py-1.5 rounded-md border border-fairlx-border hover:bg-fairlx-bg text-sm font-medium transition-colors">Open</button>
<button className="w-8 h-8 flex items-center justify-center text-fairlx-text-muted hover:text-white rounded-md hover:bg-fairlx-bg transition-colors">
<i className="fa-solid fa-ellipsis-vertical"></i>
</button>
</div>
</div>
{/* Project Row 2 */}
<div className="p-4 flex items-center justify-between hover:bg-fairlx-surface-hover transition-colors group">
<div className="flex items-center gap-4">
<div className="w-10 h-10 rounded-lg bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-500">
<i className="fa-solid fa-cube text-lg"></i>
</div>
<div>
<h4 className="text-sm font-semibold text-white mb-0.5">billing-service</h4>
<div className="flex items-center gap-2 text-xs text-fairlx-text-muted">
<span className="flex items-center gap-1"><i className="fa-brands fa-github text-[10px]"></i> Main</span>
<span>•</span>
<span>Updated 1h ago</span>
</div>
</div>
</div>
<div className="flex items-center gap-4">
<button className="px-3 py-1.5 rounded-md border border-fairlx-border hover:bg-fairlx-bg text-sm font-medium transition-colors">Open</button>
<button className="w-8 h-8 flex items-center justify-center text-fairlx-text-muted hover:text-white rounded-md hover:bg-fairlx-bg transition-colors">
<i className="fa-solid fa-ellipsis-vertical"></i>
</button>
</div>
</div>
{/* Project Row 3 */}
<div className="p-4 flex items-center justify-between hover:bg-fairlx-surface-hover transition-colors group">
<div className="flex items-center gap-4">
<div className="w-10 h-10 rounded-lg bg-blue-400/10 border border-blue-400/20 flex items-center justify-center text-blue-400">
<i className="fa-solid fa-mobile-screen text-lg"></i>
</div>
<div>
<h4 className="text-sm font-semibold text-white mb-0.5">mobile-app</h4>
<div className="flex items-center gap-2 text-xs text-fairlx-text-muted">
<span className="flex items-center gap-1"><i className="fa-brands fa-github text-[10px]"></i> Develop</span>
<span>•</span>
<span>Updated 3h ago</span>
</div>
</div>
</div>
<div className="flex items-center gap-4">
<button className="px-3 py-1.5 rounded-md border border-fairlx-border hover:bg-fairlx-bg text-sm font-medium transition-colors">Open</button>
<button className="w-8 h-8 flex items-center justify-center text-fairlx-text-muted hover:text-white rounded-md hover:bg-fairlx-bg transition-colors">
<i className="fa-solid fa-ellipsis-vertical"></i>
</button>
</div>
</div>
{/* Project Row 4 */}
<div className="p-4 flex items-center justify-between hover:bg-fairlx-surface-hover transition-colors group">
<div className="flex items-center gap-4">
<div className="w-10 h-10 rounded-lg bg-yellow-500/10 border border-yellow-500/20 flex items-center justify-center text-yellow-500">
<i className="fa-solid fa-chart-simple text-lg"></i>
</div>
<div>
<h4 className="text-sm font-semibold text-white mb-0.5">analytics-dashboard</h4>
<div className="flex items-center gap-2 text-xs text-fairlx-text-muted">
<span className="flex items-center gap-1"><i className="fa-brands fa-github text-[10px]"></i> Main</span>
<span>•</span>
<span>Updated 5h ago</span>
</div>
</div>
</div>
<div className="flex items-center gap-4">
<button className="px-3 py-1.5 rounded-md border border-fairlx-border hover:bg-fairlx-bg text-sm font-medium transition-colors">Open</button>
<button className="w-8 h-8 flex items-center justify-center text-fairlx-text-muted hover:text-white rounded-md hover:bg-fairlx-bg transition-colors">
<i className="fa-solid fa-ellipsis-vertical"></i>
</button>
</div>
</div>
</div>
</div>
</section>
</div>
{/* Right Column (Sidebar within main content) */}
<div className="space-y-6">
<McpServersCard />
{/* Tools */}
<div className="bg-fairlx-surface border border-fairlx-border rounded-xl p-5">
<div className="flex items-center justify-between mb-4">
<h3 className="font-semibold text-white">Tools</h3>
<a className="text-xs text-fairlx-text-muted hover:text-white transition-colors" href="#">View all</a>
</div>
<div className="space-y-3">
<a className="flex items-start justify-between group" href="#">
<div className="flex gap-3">
<div className="w-8 h-8 rounded-lg bg-indigo-500/10 flex items-center justify-center text-indigo-400 mt-0.5">
<i className="fa-solid fa-terminal text-sm"></i>
</div>
<div>
<h4 className="text-sm font-medium text-fairlx-text group-hover:text-white transition-colors">Code Interpreter</h4>
<p className="text-xs text-fairlx-text-muted mt-0.5">Run code and analyze results</p>
</div>
</div>
<div className="w-6 h-6 rounded-md bg-fairlx-bg border border-fairlx-border flex items-center justify-center text-fairlx-text-muted group-hover:text-white transition-colors">
<i className="fa-solid fa-chevron-right text-[10px]"></i>
</div>
</a>
<a className="flex items-start justify-between group" href="#">
<div className="flex gap-3">
<div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center text-blue-400 mt-0.5">
<i className="fa-solid fa-file-lines text-sm"></i>
</div>
<div>
<h4 className="text-sm font-medium text-fairlx-text group-hover:text-white transition-colors">File Search</h4>
<p className="text-xs text-fairlx-text-muted mt-0.5">Search and read files</p>
</div>
</div>
<div className="w-6 h-6 rounded-md bg-fairlx-bg border border-fairlx-border flex items-center justify-center text-fairlx-text-muted group-hover:text-white transition-colors">
<i className="fa-solid fa-chevron-right text-[10px]"></i>
</div>
</a>
<a className="flex items-start justify-between group" href="#">
<div className="flex gap-3">
<div className="w-8 h-8 rounded-lg bg-green-500/10 flex items-center justify-center text-green-400 mt-0.5">
<i className="fa-solid fa-globe text-sm"></i>
</div>
<div>
<h4 className="text-sm font-medium text-fairlx-text group-hover:text-white transition-colors">Web Search</h4>
<p className="text-xs text-fairlx-text-muted mt-0.5">Search the web</p>
</div>
</div>
<div className="w-6 h-6 rounded-md bg-fairlx-bg border border-fairlx-border flex items-center justify-center text-fairlx-text-muted group-hover:text-white transition-colors">
<i className="fa-solid fa-chevron-right text-[10px]"></i>
</div>
</a>
<a className="flex items-start justify-between group" href="#">
<div className="flex gap-3">
<div className="w-8 h-8 rounded-lg bg-orange-500/10 flex items-center justify-center text-orange-400 mt-0.5">
<i className="fa-solid fa-greater-than text-sm"></i>
</div>
<div>
<h4 className="text-sm font-medium text-fairlx-text group-hover:text-white transition-colors">Terminal</h4>
<p className="text-xs text-fairlx-text-muted mt-0.5">Execute terminal commands</p>
</div>
</div>
<div className="w-6 h-6 rounded-md bg-fairlx-bg border border-fairlx-border flex items-center justify-center text-fairlx-text-muted group-hover:text-white transition-colors">
<i className="fa-solid fa-chevron-right text-[10px]"></i>
</div>
</a>
<a className="flex items-start justify-between group" href="#">
<div className="flex gap-3">
<div className="w-8 h-8 rounded-lg bg-yellow-500/10 flex items-center justify-center text-yellow-400 mt-0.5">
<i className="fa-solid fa-database text-sm"></i>
</div>
<div>
<h4 className="text-sm font-medium text-fairlx-text group-hover:text-white transition-colors">Database Query</h4>
<p className="text-xs text-fairlx-text-muted mt-0.5">Query your databases</p>
</div>
</div>
<div className="w-6 h-6 rounded-md bg-fairlx-bg border border-fairlx-border flex items-center justify-center text-fairlx-text-muted group-hover:text-white transition-colors">
<i className="fa-solid fa-chevron-right text-[10px]"></i>
</div>
</a>
</div>
</div>
{/* Skills */}
<div className="bg-fairlx-surface border border-fairlx-border rounded-xl p-5">
<div className="flex items-center justify-between mb-4">
<h3 className="font-semibold text-white">Skills</h3>
<a className="text-xs text-fairlx-text-muted hover:text-white transition-colors" href="#">View all</a>
</div>
<div className="space-y-3 mb-4">
<a className="flex items-start gap-3 group" href="#">
<div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center text-blue-500 mt-0.5">
<i className="fa-solid fa-code text-sm"></i>
</div>
<div>
<h4 className="text-sm font-medium text-fairlx-text group-hover:text-white transition-colors">Frontend Developer</h4>
<p className="text-xs text-fairlx-text-muted mt-0.5">React, TypeScript, Tailwind</p>
</div>
</a>
<a className="flex items-start gap-3 group" href="#">
<div className="w-8 h-8 rounded-lg bg-indigo-500/10 flex items-center justify-center text-indigo-400 mt-0.5">
<i className="fa-solid fa-server text-sm"></i>
</div>
<div>
<h4 className="text-sm font-medium text-fairlx-text group-hover:text-white transition-colors">Backend Developer</h4>
<p className="text-xs text-fairlx-text-muted mt-0.5">Node.js, PostgreSQL, APIs</p>
</div>
</a>
<a className="flex items-start gap-3 group" href="#">
<div className="w-8 h-8 rounded-lg bg-sky-500/10 flex items-center justify-center text-sky-400 mt-0.5">
<i className="fa-solid fa-cloud text-sm"></i>
</div>
<div>
<h4 className="text-sm font-medium text-fairlx-text group-hover:text-white transition-colors">DevOps Engineer</h4>
<p className="text-xs text-fairlx-text-muted mt-0.5">Docker, CI/CD, AWS</p>
</div>
</a>
</div>
<button className="w-full py-2 rounded-lg border border-dashed border-fairlx-border text-sm text-fairlx-text-muted hover:text-white hover:border-fairlx-text-muted transition-colors flex items-center justify-center gap-2">
<i className="fa-solid fa-plus text-xs"></i> Add Skill
            </button>
</div>
</div>
</div>
</main>
</div>
{/* END: Main Content Area */}
        </div>
    );
}
