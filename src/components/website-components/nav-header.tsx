'use client'
import { Logo } from '@/components/ui/logo'
import Link from 'next/link'
import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Menu, X, User, Github } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { User as UserType } from '@supabase/supabase-js'
import { ThemeToggle } from '@/components/theme-toggle'

const menuItems = [
    { name: 'Features', href: '/features' },
    { name: 'Styleguide', href: '/styleguide' },
]

interface NavHeaderProps {
    fullWidth?: boolean;
}

export default function NavHeader({ fullWidth = false }: NavHeaderProps) {
    const [menuState, setMenuState] = useState(false)
    const [user, setUser] = useState<UserType | null>(null)
    const router = useRouter()
    const supabase = createClient()

    useEffect(() => {
        const getUser = async () => {
            const { data: { user } } = await supabase.auth.getUser()
            setUser(user)
        }

        getUser()

        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            setUser(session?.user ?? null)
        })

        return () => subscription.unsubscribe()
    }, [supabase.auth])

    const handleSignOut = async () => {
        await supabase.auth.signOut()
        router.refresh()
    }

    const handleMenuItemClick = () => {
        // Close mobile menu when an item is clicked
        setMenuState(false)
    }

    const containerClass = fullWidth ? "container mx-auto px-4" : "m-auto max-w-5xl px-6"

    return (
        <header>
            <nav
                data-state={menuState && 'active'}
                className="fixed z-20 w-full border-b border-dashed bg-white backdrop-blur md:relative dark:bg-zinc-950/50 lg:dark:bg-transparent">
                <div className={containerClass}>
                    <div className="flex flex-wrap items-center justify-between gap-6 py-3 lg:gap-0 lg:py-4">
                        <div className="flex w-full justify-between lg:w-auto">
                            <Link
                                href="/"
                                aria-label="home"
                                className="flex items-center space-x-2">
                                <Logo />
                            </Link>

                            <button
                                onClick={() => setMenuState(!menuState)}
                                aria-label={menuState == true ? 'Close Menu' : 'Open Menu'}
                                className="relative z-20 -m-2.5 -mr-4 block cursor-pointer p-2.5 lg:hidden">
                                <Menu className="in-data-[state=active]:rotate-180 in-data-[state=active]:scale-0 in-data-[state=active]:opacity-0 m-auto size-6 duration-200" />
                                <X className="in-data-[state=active]:rotate-0 in-data-[state=active]:scale-100 in-data-[state=active]:opacity-100 absolute inset-0 m-auto size-6 -rotate-180 scale-0 opacity-0 duration-200" />
                            </button>
                        </div>

                        <div className="bg-background in-data-[state=active]:block lg:in-data-[state=active]:flex mb-6 hidden w-full flex-wrap items-center justify-end space-y-8 rounded-3xl border p-6 shadow-2xl shadow-zinc-300/20 md:flex-nowrap lg:m-0 lg:flex lg:w-fit lg:gap-6 lg:space-y-0 lg:border-transparent lg:bg-transparent lg:p-0 lg:shadow-none dark:shadow-none dark:lg:bg-transparent">
                            <div className="lg:pr-4">
                                <ul className="space-y-6 text-base lg:flex lg:gap-8 lg:space-y-0 lg:text-sm">
                                    {menuItems.map((item, index) => (
                                        <li key={index}>
                                            <a
                                                href={item.href}
                                                onClick={handleMenuItemClick}
                                                className="text-muted-foreground hover:text-accent-foreground block duration-150">
                                                <span>{item.name}</span>
                                            </a>
                                        </li>
                                    ))}
                                </ul>
                            </div>

                            <div className="flex w-full flex-col space-y-3 sm:flex-row sm:gap-3 sm:space-y-0 md:w-fit lg:border-l lg:pl-6">
                                <div className="flex items-center gap-3">
                                    <a 
                                        href="https://github.com/jacemadedev/supastart"
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="rounded-md p-2 hover:bg-gray-100 dark:hover:bg-gray-800"
                                        aria-label="GitHub"
                                    >
                                        <Github className="h-4 w-4" />
                                    </a>
                                    <ThemeToggle />
                                </div>
                                {user ? (
                                    <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                            <Button variant="outline" size="sm">
                                                <User className="mr-2 h-4 w-4" />
                                                {user.email}
                                            </Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent align="end">
                                            <DropdownMenuItem asChild>
                                                <Link href="/dashboard">Dashboard</Link>
                                            </DropdownMenuItem>
                                            <DropdownMenuItem asChild>
                                                <Link href="/settings">Settings</Link>
                                            </DropdownMenuItem>
                                            <DropdownMenuItem onClick={handleSignOut}>
                                                Sign Out
                                            </DropdownMenuItem>
                                        </DropdownMenuContent>
                                    </DropdownMenu>
                                ) : (
                                    <>
                                        <Button
                                            asChild
                                            variant="outline"
                                            size="sm">
                                            <Link href="/auth/login">
                                                <span>Sign In</span>
                                            </Link>
                                        </Button>
                                        <Button
                                            asChild
                                            size="sm">
                                            <Link href="/auth/sign-up">
                                                <span>Get Started</span>
                                            </Link>
                                        </Button>
                                    </>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </nav>
        </header>
    )
} 