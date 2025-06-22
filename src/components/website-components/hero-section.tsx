'use client'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import Image from 'next/image'
import { useEffect, useState } from 'react'
import { CopyCommand } from '@/components/ui/copy-command'

export default function HeroSection() {
    const [isDarkMode, setIsDarkMode] = useState(false);
    
    useEffect(() => {
        // Check if dark mode is active
        const darkModeMediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
        const htmlDarkClass = document.documentElement.classList.contains('dark');
        
        setIsDarkMode(darkModeMediaQuery.matches || htmlDarkClass);
        
        // Listen for changes in the color scheme preference
        const handleChange = (e: MediaQueryListEvent) => {
            setIsDarkMode(e.matches || document.documentElement.classList.contains('dark'));
        };
        
        darkModeMediaQuery.addEventListener('change', handleChange);
        
        // Also listen for theme toggle changes via DOM
        const observer = new MutationObserver(() => {
            setIsDarkMode(darkModeMediaQuery.matches || document.documentElement.classList.contains('dark'));
        });
        
        observer.observe(document.documentElement, {
            attributes: true,
            attributeFilter: ['class'],
        });
        
        return () => {
            darkModeMediaQuery.removeEventListener('change', handleChange);
            observer.disconnect();
        };
    }, []);

    return (
        <>
            <main>
                <div
                    aria-hidden
                    className="z-2 absolute inset-0 isolate hidden opacity-70 dark:opacity-60 contain-strict lg:block">
                    <div className="w-140 h-320 -translate-y-87.5 absolute left-0 top-0 -rotate-45 rounded-full bg-[radial-gradient(68.54%_68.72%_at_55.02%_31.46%,hsla(0,0%,85%,.08)_0,hsla(0,0%,55%,.02)_50%,hsla(0,0%,45%,0)_80%)] dark:bg-[radial-gradient(68.54%_68.72%_at_55.02%_31.46%,hsla(0,0%,95%,.15)_0,hsla(0,0%,80%,.05)_50%,hsla(0,0%,70%,0)_80%)]" />
                    <div className="h-320 absolute left-0 top-0 w-60 -rotate-45 rounded-full bg-[radial-gradient(50%_50%_at_50%_50%,hsla(0,0%,85%,.06)_0,hsla(0,0%,45%,.02)_80%,transparent_100%)] dark:bg-[radial-gradient(50%_50%_at_50%_50%,hsla(0,0%,95%,.12)_0,hsla(0,0%,80%,.04)_80%,transparent_100%)] [translate:5%_-50%]" />
                    <div className="h-320 -translate-y-87.5 absolute left-0 top-0 w-60 -rotate-45 bg-[radial-gradient(50%_50%_at_50%_50%,hsla(0,0%,85%,.04)_0,hsla(0,0%,45%,.02)_80%,transparent_100%)] dark:bg-[radial-gradient(50%_50%_at_50%_50%,hsla(0,0%,95%,.1)_0,hsla(0,0%,80%,.03)_80%,transparent_100%)]" />
                </div>

                <section className="overflow-hidden bg-white dark:bg-transparent">
                    <div className="relative mx-auto max-w-5xl px-6 py-28 lg:py-24">
                        <div className="relative z-10 mx-auto max-w-2xl text-center">
                            <CopyCommand 
                                command="npx create-next-app -e supastart" 
                                label="Easy to install" 
                                className="mb-6"
                            />
                            <h1 className="font-mono text-balance text-4xl font-semibold md:text-5xl lg:text-6xl">A Supabase Starter Kit for dummies</h1>
                            <p className="font-mono mx-auto my-8 max-w-2xl text-xl">Launch your app fast and secure with cursor.</p>

                            <Button
                                asChild
                                size="lg">
                                <Link href="#">
                                    <span className="btn-label">Start Building</span>
                                </Link>
                            </Button>
                        </div>
                    </div>

                    <div className="mx-auto -mt-16 max-w-7xl">
                        <div className="perspective-distant -mr-16 pl-16 lg:-mr-56 lg:pl-56">
                            <div className="[transform:rotateX(20deg);]">
                                <div className="lg:h-176 relative skew-x-[.36rad]">
                                    <div
                                        aria-hidden
                                        className="bg-linear-to-b from-background to-background z-1 absolute -inset-16 via-transparent sm:-inset-32"
                                    />
                                    <div
                                        aria-hidden
                                        className="bg-linear-to-r from-background to-background z-1 absolute -inset-16 bg-white/50 via-transparent sm:-inset-32 dark:bg-transparent"
                                    />

                                    <div
                                        aria-hidden
                                        className="absolute -inset-16 bg-[linear-gradient(to_right,var(--color-border)_1px,transparent_1px),linear-gradient(to_bottom,var(--color-border)_1px,transparent_1px)] bg-[size:24px_24px] [--color-border:var(--color-zinc-400)] sm:-inset-32 dark:[--color-border:color-mix(in_oklab,var(--color-white)_20%,transparent)]"
                                    />
                                    <div
                                        aria-hidden
                                        className="from-background z-11 absolute inset-0 bg-gradient-to-l"
                                    />
                                    <div
                                        aria-hidden
                                        className="z-2 absolute inset-0 size-full items-center px-5 py-24 [background:radial-gradient(125%_125%_at_50%_10%,transparent_40%,var(--color-background)_100%)]"
                                    />
                                    <div
                                        aria-hidden
                                        className="z-2 absolute inset-0 size-full items-center px-5 py-24 [background:radial-gradient(125%_125%_at_50%_10%,transparent_40%,var(--color-background)_100%)]"
                                    />

                                    <Image
                                        className="rounded-(--radius) z-1 relative border"
                                        src={isDarkMode ? "/hero-section-screenshot-dark.png" : "/hero-section-screenshot.png"}
                                        alt="Hero section screenshot"
                                        width={2880}
                                        height={2074}
                                        priority
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                </section>
                <section className="bg-background relative z-10 py-16">
                    <div className="m-auto max-w-5xl px-6">
                        <h2 className="font-mono text-center text-lg font-medium">These companies did not sponsor us (yet?).</h2>
                        <div className="mx-auto mt-20 flex max-w-4xl flex-wrap items-center justify-center gap-x-12 gap-y-8 sm:gap-x-16 sm:gap-y-12">
                            <img
                                className="h-5 w-fit dark:invert"
                                src="https://html.tailus.io/blocks/customers/nvidia.svg"
                                alt="Nvidia Logo"
                                height="20"
                                width="auto"
                            />
                            <img
                                className="h-4 w-fit dark:invert"
                                src="https://html.tailus.io/blocks/customers/column.svg"
                                alt="Column Logo"
                                height="16"
                                width="auto"
                            />
                            <img
                                className="h-4 w-fit dark:invert"
                                src="https://html.tailus.io/blocks/customers/github.svg"
                                alt="GitHub Logo"
                                height="16"
                                width="auto"
                            />
                            <img
                                className="h-5 w-fit dark:invert"
                                src="https://html.tailus.io/blocks/customers/nike.svg"
                                alt="Nike Logo"
                                height="20"
                                width="auto"
                            />
                            <img
                                className="h-4 w-fit dark:invert"
                                src="https://html.tailus.io/blocks/customers/laravel.svg"
                                alt="Laravel Logo"
                                height="16"
                                width="auto"
                            />
                            <img
                                className="h-7 w-fit dark:invert"
                                src="https://html.tailus.io/blocks/customers/lilly.svg"
                                alt="Lilly Logo"
                                height="28"
                                width="auto"
                            />
                            <img
                                className="h-5 w-fit dark:invert"
                                src="https://html.tailus.io/blocks/customers/lemonsqueezy.svg"
                                alt="Lemon Squeezy Logo"
                                height="20"
                                width="auto"
                            />
                            <img
                                className="h-6 w-fit dark:invert"
                                src="https://html.tailus.io/blocks/customers/openai.svg"
                                alt="OpenAI Logo"
                                height="24"
                                width="auto"
                            />
                            <img
                                className="h-4 w-fit dark:invert"
                                src="https://html.tailus.io/blocks/customers/tailwindcss.svg"
                                alt="Tailwind CSS Logo"
                                height="16"
                                width="auto"
                            />
                            <img
                                className="h-5 w-fit dark:invert"
                                src="https://html.tailus.io/blocks/customers/vercel.svg"
                                alt="Vercel Logo"
                                height="20"
                                width="auto"
                            />
                            <img
                                className="h-5 w-fit dark:invert"
                                src="https://html.tailus.io/blocks/customers/zapier.svg"
                                alt="Zapier Logo"
                                height="20"
                                width="auto"
                            />
                        </div>
                    </div>
                </section>
            </main>
        </>
    )
}
