'use client'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { VideoPlayer } from '@/components/modals/video-player'

export default function DemoSection() {
    const [isDarkMode, setIsDarkMode] = useState(false);
    const [showVideoModal, setShowVideoModal] = useState(false);
    
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

        // Handle browser back navigation for closing the video
        const handlePopState = () => {
            setShowVideoModal(false);
        };

        window.addEventListener('popstate', handlePopState);
        
        return () => {
            darkModeMediaQuery.removeEventListener('change', handleChange);
            observer.disconnect();
            window.removeEventListener('popstate', handlePopState);
        };
    }, []);

    const handlePlayVideo = () => {
        // Add a history entry before showing the modal
        window.history.pushState({modal: 'video'}, '');
        setShowVideoModal(true);
    };

    return (
        <section className="py-8 md:py-16 dark:bg-transparent">
            <div className="mx-auto max-w-5xl px-6">
                <div className="mb-16 text-center">
                    <h2 className="font-mono text-balance text-3xl font-semibold md:text-4xl lg:text-5xl">See it in action</h2>
                    <p className="font-mono mt-4 mx-auto max-w-2xl text-muted-foreground">Watch how easy it is to build and deploy your Supabase app.</p>
                    
                    <div className="mt-8">
                        <Button
                            asChild
                            size="lg">
                            <Link href="#">
                                <span className="btn-label">Get Started</span>
                            </Link>
                        </Button>
                    </div>
                </div>
                
                <div 
                    className="relative aspect-video w-full overflow-hidden rounded-lg border bg-secondary/50 shadow-md cursor-pointer"
                    onClick={handlePlayVideo}
                >
                    {/* Video thumbnail with play button overlay */}
                    <div className="relative w-full h-full">
                        {/* Video thumbnail - uses different images based on theme */}
                        <img 
                            src={isDarkMode ? "/hero-section-screenshot-dark.png" : "/hero-section-screenshot.png"} 
                            alt="Product demo thumbnail"
                            className="w-full h-full object-cover object-top"
                        />
                        
                        {/* Play button overlay */}
                        <div className="absolute inset-0 flex items-center justify-center">
                            <div className="rounded-full bg-primary/90 p-4 shadow-lg transition-transform hover:scale-110">
                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="white" className="h-8 w-8">
                                    <path d="M8 5.14v14l11-7-11-7z" />
                                </svg>
                            </div>
                        </div>
                    </div>
                </div>
                
                {/* Video caption/description (optional) */}
                <p className="mt-4 text-center text-sm text-muted-foreground">
                    Full walkthrough of the setup process and key features
                </p>
            </div>

            {/* Video Modal */}
            <VideoPlayer 
                videoId="yOI_Y5c-_rY"
                title="Supastart Demo"
                isOpen={showVideoModal}
            />
        </section>
    )
} 