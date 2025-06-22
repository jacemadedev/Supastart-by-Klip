import { Card, CardContent } from '@/components/ui/card'
import { Shield, Users } from 'lucide-react'

export default function BentoFeaturesSection() {
    return (
        <section className="py-8 md:py-16 dark:bg-transparent">
            <div className="mx-auto max-w-5xl px-6">
                <div className="mb-16 text-center">
                    <h2 className="font-mono text-balance text-3xl font-semibold md:text-4xl lg:text-5xl">Vibe Code Starter Kit</h2>
                    <p className="font-mono mt-4 mx-auto max-w-2xl text-muted-foreground">Everything you need to build modern SaaS applications with Supabase, Next.js, and Stripe integration out of the box.</p>
                </div>
                <div className="relative">
                    <div className="relative z-10 grid grid-cols-6 gap-3">
                        <Card className="relative col-span-full flex overflow-hidden lg:col-span-2">
                            <CardContent className="relative m-auto size-fit pt-6">
                                <div className="relative flex h-24 w-56 items-center">
                                    <svg className="text-muted absolute inset-0 size-full" viewBox="0 0 254 104" fill="none" xmlns="http://www.w3.org/2000/svg">
                                        <path
                                            d="M112.891 97.7022C140.366 97.0802 171.004 94.6715 201.087 87.5116C210.43 85.2881 219.615 82.6412 228.284 78.2473C232.198 76.3179 235.905 73.9942 239.348 71.3124C241.85 69.2557 243.954 66.7571 245.555 63.9408C249.34 57.3235 248.281 50.5341 242.498 45.6109C239.033 42.7237 235.228 40.2703 231.169 38.3054C219.443 32.7209 207.141 28.4382 194.482 25.534C184.013 23.1927 173.358 21.7755 162.64 21.2989C161.376 21.3512 160.113 21.181 158.908 20.796C158.034 20.399 156.857 19.1682 156.962 18.4535C157.115 17.8927 157.381 17.3689 157.743 16.9139C158.104 16.4588 158.555 16.0821 159.067 15.8066C160.14 15.4683 161.274 15.3733 162.389 15.5286C179.805 15.3566 196.626 18.8373 212.998 24.462C220.978 27.2494 228.798 30.4747 236.423 34.1232C240.476 36.1159 244.202 38.7131 247.474 41.8258C254.342 48.2578 255.745 56.9397 251.841 65.4892C249.793 69.8582 246.736 73.6777 242.921 76.6327C236.224 82.0192 228.522 85.4602 220.502 88.2924C205.017 93.7847 188.964 96.9081 172.738 99.2109C153.442 101.949 133.993 103.478 114.506 103.79C91.1468 104.161 67.9334 102.97 45.1169 97.5831C36.0094 95.5616 27.2626 92.1655 19.1771 87.5116C13.839 84.5746 9.1557 80.5802 5.41318 75.7725C-0.54238 67.7259 -1.13794 59.1763 3.25594 50.2827C5.82447 45.3918 9.29572 41.0315 13.4863 37.4319C24.2989 27.5721 37.0438 20.9681 50.5431 15.7272C68.1451 8.8849 86.4883 5.1395 105.175 2.83669C129.045 0.0992292 153.151 0.134761 177.013 2.94256C197.672 5.23215 218.04 9.01724 237.588 16.3889C240.089 17.3418 242.498 18.5197 244.933 19.6446C246.627 20.4387 247.725 21.6695 246.997 23.615C246.455 25.1105 244.814 25.5605 242.63 24.5811C230.322 18.9961 217.233 16.1904 204.117 13.4376C188.761 10.3438 173.2 8.36665 157.558 7.52174C129.914 5.70776 102.154 8.06792 75.2124 14.5228C60.6177 17.8788 46.5758 23.2977 33.5102 30.6161C26.6595 34.3329 20.4123 39.0673 14.9818 44.658C12.9433 46.8071 11.1336 49.1622 9.58207 51.6855C4.87056 59.5336 5.61172 67.2494 11.9246 73.7608C15.2064 77.0494 18.8775 79.925 22.8564 82.3236C31.6176 87.7101 41.3848 90.5291 51.3902 92.5804C70.6068 96.5773 90.0219 97.7419 112.891 97.7022Z"
                                            fill="currentColor"
                                        />
                                    </svg>
                                    <span className="mx-auto block w-fit text-5xl font-semibold">100%</span>
                                </div>
                                <h2 className="mt-6 text-center text-3xl font-semibold">Type Safe</h2>
                            </CardContent>
                        </Card>
                        <Card className="relative col-span-full overflow-hidden sm:col-span-3 lg:col-span-2">
                            <CardContent className="pt-6">
                                <div className="relative mx-auto flex aspect-square size-32 rounded-full border border-gray-200 dark:border-white/10 before:absolute before:-inset-2 before:rounded-full before:border before:border-gray-100 dark:before:border-white/5">
                                    <img 
                                        className="m-auto size-20 rounded-full" 
                                        src="https://avatars.githubusercontent.com/u/54469796?s=200&v=4" 
                                        alt="Supabase logo" 
                                    />
                                </div>
                                <div className="relative z-10 mt-6 space-y-2 text-center">
                                    <h2 className="group-hover:text-secondary-950 text-lg font-medium transition dark:text-white">Secure by default</h2>
                                    <p className="text-foreground">Built-in authentication, Row Level Security, and secure API endpoints to keep your data safe.</p>
                                </div>
                            </CardContent>
                        </Card>
                        <Card className="relative col-span-full overflow-hidden sm:col-span-3 lg:col-span-2">
                            <CardContent className="pt-6">
                                <div className="pt-6 lg:px-6">
                                    <div className="relative flex justify-center items-center h-40 mx-auto">
                                        {/* Orbital paths */}
                                        <div className="absolute w-32 h-32 rounded-full border border-gray-200 dark:border-muted-foreground/30 opacity-50"></div>
                                        
                                        {/* Center (Cursor) logo - larger */}
                                        <div className="absolute z-10 flex aspect-square size-24 rounded-full border border-gray-200 dark:border-white/10 before:absolute before:-inset-1 before:rounded-full before:border before:border-gray-100 dark:before:border-white/5 bg-background shadow-md">
                                            <img 
                                                className="m-auto size-16 rounded-full" 
                                                src="/cursor_logo.png" 
                                                alt="Cursor logo" 
                                            />
                                        </div>
                                        
                                        {/* Top left (Lovable) logo - smaller */}
                                        <div className="absolute transform -translate-x-16 -translate-y-16 flex aspect-square size-16 rounded-full border border-gray-200 dark:border-white/10 before:absolute before:-inset-1 before:rounded-full before:border before:border-gray-100 dark:before:border-white/5 bg-background">
                                            <img 
                                                className="m-auto size-10 rounded-full" 
                                                src="/lovable_logo.svg" 
                                                alt="Lovable logo" 
                                            />
                                        </div>
                                        
                                        {/* Bottom right (Bolt) logo - smaller */}
                                        <div className="absolute transform translate-x-16 translate-y-16 flex aspect-square size-16 rounded-full border border-gray-200 dark:border-white/10 before:absolute before:-inset-1 before:rounded-full before:border before:border-gray-100 dark:before:border-white/5 bg-background">
                                            <img 
                                                className="m-auto size-10 rounded-full" 
                                                src="/bolt_logo.jpeg" 
                                                alt="Bolt logo" 
                                            />
                                        </div>
                                        
                                        {/* Connecting lines */}
                                        <div className="absolute w-full h-full pointer-events-none">
                                            <div className="absolute left-1/2 top-1/2 h-px w-16 -translate-x-full -translate-y-full -rotate-45 bg-gradient-to-r from-transparent via-gray-300 dark:via-muted-foreground/30 to-transparent"></div>
                                            <div className="absolute left-1/2 top-1/2 h-px w-16 translate-x-0 translate-y-0 rotate-45 bg-gradient-to-r from-transparent via-gray-300 dark:via-muted-foreground/30 to-transparent"></div>
                                        </div>
                                    </div>
                                </div>
                                <div className="relative z-10 mt-6 space-y-2 text-center">
                                    <h2 className="text-lg font-medium transition">Vibe Code Compatible</h2>
                                </div>
                            </CardContent>
                        </Card>
                        <Card className="card variant-outlined relative col-span-full overflow-hidden lg:col-span-3">
                            <CardContent className="grid pt-6 sm:grid-cols-2">
                                <div className="relative z-10 flex flex-col justify-between space-y-12 lg:space-y-6">
                                    <div className="relative flex aspect-square size-12 rounded-full border border-gray-200 dark:border-white/10 before:absolute before:-inset-2 before:rounded-full before:border before:border-gray-100 dark:before:border-white/5">
                                        <Shield className="m-auto size-5" strokeWidth={1} />
                                    </div>
                                    <div className="space-y-2">
                                        <h2 className="group-hover:text-secondary-950 text-lg font-medium text-zinc-800 transition dark:text-white">Modern Tech Stack</h2>
                                        <p className="text-foreground">Seamlessly integrates Next.js, Supabase, and shadcn/ui for a powerful and flexible development experience.</p>
                                    </div>
                                </div>
                                <div className="before:bg-(--color-border) relative mt-6 before:absolute before:inset-0 before:mx-auto before:w-px sm:-my-6 sm:-mr-6">
                                    <div className="relative flex h-full flex-col justify-center space-y-6 py-6">
                                        <div className="relative flex w-[calc(50%+0.875rem)] items-center justify-end gap-2">
                                            <span className="block h-fit rounded border px-2 py-1 text-xs shadow-sm">Next.js</span>
                                            <div className="ring-background size-7 ring-4">
                                                <img className="size-full rounded-full" src="https://avatars.githubusercontent.com/u/14985020?s=200&v=4" alt="Next.js logo" />
                                            </div>
                                        </div>
                                        <div className="relative ml-[calc(50%-1rem)] flex items-center gap-2">
                                            <div className="ring-background size-8 ring-4">
                                                <img className="size-full rounded-full" src="https://avatars.githubusercontent.com/u/54469796?s=200&v=4" alt="Supabase logo" />
                                            </div>
                                            <span className="block h-fit rounded border px-2 py-1 text-xs shadow-sm">Supabase</span>
                                        </div>
                                        <div className="relative flex w-[calc(50%+0.875rem)] items-center justify-end gap-2">
                                            <span className="block h-fit rounded border px-2 py-1 text-xs shadow-sm">shadcn/ui</span>
                                            <div className="ring-background size-7 ring-4">
                                                <img className="size-full rounded-full" src="https://avatars.githubusercontent.com/u/124599?v=4" alt="shadcn/ui logo" />
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                        <Card className="card variant-outlined relative col-span-full overflow-hidden lg:col-span-3">
                            <CardContent className="grid h-full pt-6 sm:grid-cols-2">
                                <div className="relative z-10 flex flex-col justify-between space-y-12 lg:space-y-6">
                                    <div className="relative flex aspect-square size-12 rounded-full border border-gray-200 dark:border-white/10 before:absolute before:-inset-2 before:rounded-full before:border before:border-gray-100 dark:before:border-white/5">
                                        <Users className="m-auto size-6" strokeWidth={1} />
                                    </div>
                                    <div className="space-y-2">
                                        <h2 className="text-lg font-medium transition">Built for Teams</h2>
                                        <p className="text-foreground">Multi-tenant architecture, team collaboration features, and role-based access control.</p>
                                    </div>
                                </div>
                                <div className="before:bg-(--color-border) relative mt-6 before:absolute before:inset-0 before:mx-auto before:w-px sm:-my-6 sm:-mr-6">
                                    <div className="relative flex h-full flex-col justify-center space-y-6 py-6">
                                        <div className="relative flex w-[calc(50%+0.875rem)] items-center justify-end gap-2">
                                            <span className="block h-fit rounded border px-2 py-1 text-xs shadow-sm">Likeur</span>
                                            <div className="ring-background size-7 ring-4">
                                                <img className="size-full rounded-full" src="https://avatars.githubusercontent.com/u/102558960?v=4" alt="" />
                                            </div>
                                        </div>
                                        <div className="relative ml-[calc(50%-1rem)] flex items-center gap-2">
                                            <div className="ring-background size-8 ring-4">
                                                <img className="size-full rounded-full" src="https://avatars.githubusercontent.com/u/47919550?v=4" alt="" />
                                            </div>
                                            <span className="block h-fit rounded border px-2 py-1 text-xs shadow-sm">M. Irung</span>
                                        </div>
                                        <div className="relative flex w-[calc(50%+0.875rem)] items-center justify-end gap-2">
                                            <span className="block h-fit rounded border px-2 py-1 text-xs shadow-sm">B. Ng</span>
                                            <div className="ring-background size-7 ring-4">
                                                <img className="size-full rounded-full" src="https://avatars.githubusercontent.com/u/31113941?v=4" alt="" />
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                </div>
            </div>
        </section>
    )
}
