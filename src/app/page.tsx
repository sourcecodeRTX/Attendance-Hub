"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Users,
  Shield,
  Wifi,
  WifiOff,
  BarChart3,
  Clock,
  CheckCircle2,
  ArrowRight,
  GraduationCap,
  Building2,
  UserCheck,
  Zap,
  Lock,
  RefreshCw,
  ChevronDown,
  Menu,
  X,
} from "lucide-react";

// Intersection Observer hook for scroll animations
function useInView(options: IntersectionObserverInit = {}) {
  const ref = useRef<HTMLDivElement>(null);
  const [isInView, setIsInView] = useState(false);
  const { threshold = 0.1, root, rootMargin } = options;

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsInView(true);
        }
      },
      { threshold, root, rootMargin }
    );

    if (ref.current) {
      observer.observe(ref.current);
    }

    return () => observer.disconnect();
  }, [threshold, root, rootMargin]);

  return { ref, isInView };
}

// Navigation component
function Navigation() {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <nav
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        isScrolled
          ? "bg-white/80 backdrop-blur-xl shadow-sm border-b border-neutral-200/50"
          : "bg-transparent"
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 lg:h-20">
          {/* Logo */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-neutral-900 to-neutral-700 flex items-center justify-center shadow-lg">
              <GraduationCap className="w-5 h-5 text-white" />
            </div>
            <span className="text-xl font-semibold tracking-tight">Attendance Hub</span>
          </div>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center gap-8">
            <a href="#features" className="text-sm text-neutral-600 hover:text-neutral-900 transition-colors">
              Features
            </a>
            <a href="#how-it-works" className="text-sm text-neutral-600 hover:text-neutral-900 transition-colors">
              How It Works
            </a>
            <a href="#roles" className="text-sm text-neutral-600 hover:text-neutral-900 transition-colors">
              For Teams
            </a>
          </div>

          {/* Auth Buttons */}
          <div className="hidden md:flex items-center gap-3">
            <Link href="/login">
              <Button variant="ghost" size="sm">
                Sign In
              </Button>
            </Link>
            <Link href="/register">
              <Button size="sm" className="shadow-lg shadow-neutral-900/20">
                Get Started
                <ArrowRight className="w-4 h-4 ml-1" />
              </Button>
            </Link>
          </div>

          {/* Mobile Menu Button */}
          <button
            className="md:hidden p-2 rounded-lg hover:bg-neutral-100 transition-colors"
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          >
            {isMobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>

        {/* Mobile Menu */}
        {isMobileMenuOpen && (
          <div className="md:hidden py-4 border-t border-neutral-200/50 bg-white/95 backdrop-blur-xl">
            <div className="flex flex-col gap-4">
              <a href="#features" className="text-sm text-neutral-600 hover:text-neutral-900 transition-colors py-2">
                Features
              </a>
              <a href="#how-it-works" className="text-sm text-neutral-600 hover:text-neutral-900 transition-colors py-2">
                How It Works
              </a>
              <a href="#roles" className="text-sm text-neutral-600 hover:text-neutral-900 transition-colors py-2">
                For Teams
              </a>
              <div className="flex flex-col gap-2 pt-4 border-t border-neutral-200/50">
                <Link href="/login">
                  <Button variant="outline" className="w-full">
                    Sign In
                  </Button>
                </Link>
                <Link href="/register">
                  <Button className="w-full">
                    Get Started
                    <ArrowRight className="w-4 h-4 ml-1" />
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        )}
      </div>
    </nav>
  );
}

// Hero Section
function HeroSection() {
  const { ref, isInView } = useInView();

  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden pt-16 sm:pt-20">
      {/* Background Elements */}
      <div className="absolute inset-0 bg-gradient-to-b from-neutral-50 via-white to-neutral-50/50" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-neutral-100/50 via-transparent to-transparent" />
      
      {/* Animated Grid Pattern */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#00000008_1px,transparent_1px),linear-gradient(to_bottom,#00000008_1px,transparent_1px)] bg-[size:2rem_2rem] sm:bg-[size:4rem_4rem]" />
      
      {/* Floating Elements - Responsive */}
      <div className="absolute top-1/4 left-[5%] sm:left-[10%] w-48 h-48 sm:w-72 sm:h-72 bg-gradient-to-br from-neutral-200/40 to-transparent rounded-full blur-3xl animate-pulse" />
      <div className="absolute bottom-1/4 right-[5%] sm:right-[10%] w-64 h-64 sm:w-96 sm:h-96 bg-gradient-to-tl from-neutral-200/30 to-transparent rounded-full blur-3xl animate-pulse" style={{ animationDelay: "1s" }} />

      <div ref={ref} className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-20 lg:py-32">
        <div className="grid lg:grid-cols-2 gap-8 sm:gap-12 lg:gap-20 items-center">
          {/* Left Content */}
          <div className={`transition-all duration-1000 ease-out ${isInView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-10"}`}>
            {/* Badge */}
            <div className="inline-flex items-center gap-2 px-3 py-1.5 sm:px-4 sm:py-2 rounded-full bg-neutral-100 border border-neutral-200/50 text-xs sm:text-sm text-neutral-600 mb-6 sm:mb-8 transition-all duration-300 hover:shadow-lg hover:scale-105">
              <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              Trusted by Universities Worldwide
            </div>

            {/* Main Headline */}
            <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl xl:text-7xl font-bold tracking-tight text-neutral-900 leading-[1.1] mb-4 sm:mb-6">
              Attendance
              <br />
              <span className="bg-gradient-to-r from-neutral-900 via-neutral-600 to-neutral-900 bg-clip-text text-transparent bg-[length:200%] animate-gradient">
                Reimagined
              </span>
            </h1>

            <p className="text-base sm:text-lg lg:text-xl text-neutral-600 leading-relaxed mb-8 sm:mb-10 max-w-xl">
              The modern way to track, manage, and analyze attendance across your entire institution. 
              Real-time sync, offline support, and powerful insights in one seamless platform.
            </p>

            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 mb-8 sm:mb-12">
              <Link href="/register" className="w-full sm:w-auto">
                <Button size="lg" className="w-full sm:w-auto text-sm sm:text-base px-6 sm:px-8 py-5 sm:py-6 shadow-xl shadow-neutral-900/20 hover:shadow-2xl hover:shadow-neutral-900/30 transition-all duration-300 hover:scale-[1.02]">
                  Register
                  <ArrowRight className="w-4 h-4 sm:w-5 sm:h-5 ml-2" />
                </Button>
              </Link>
              <Link href="/login" className="w-full sm:w-auto">
                <Button variant="outline" size="lg" className="w-full sm:w-auto text-sm sm:text-base px-6 sm:px-8 py-5 sm:py-6 transition-all duration-300 hover:scale-[1.02] hover:bg-neutral-50">
                  Sign In
                </Button>
              </Link>
            </div>

            {/* Trust Indicators */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-6 lg:gap-8 text-xs sm:text-sm text-neutral-500">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-3 h-3 sm:w-4 sm:h-4 text-green-500" />
                No credit card required
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-3 h-3 sm:w-4 sm:h-4 text-green-500" />
                Cancel anytime
              </div>
            </div>
          </div>

          {/* Right Content - Floating Cards */}
          <div className={`relative transition-all duration-1000 ease-out ${isInView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-10"}`} style={{ transitionDelay: "300ms" }}>
            <div className="relative w-full aspect-square max-w-lg mx-auto">
              {/* Main Dashboard Card */}
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[90%] sm:w-[85%] bg-white rounded-xl sm:rounded-2xl shadow-2xl border border-neutral-200/50 p-4 sm:p-6 z-20 transition-all duration-500 hover:shadow-3xl hover:scale-[1.02]">
                <div className="flex items-center justify-between mb-4 sm:mb-6">
                  <div>
                    <p className="text-xs sm:text-sm text-neutral-500">Today&apos;s Attendance</p>
                    <p className="text-2xl sm:text-3xl font-bold">94.2%</p>
                  </div>
                  <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-lg sm:rounded-xl bg-green-100 flex items-center justify-center">
                    <UserCheck className="w-5 h-5 sm:w-6 sm:h-6 text-green-600" />
                  </div>
                </div>
                <div className="space-y-2 sm:space-y-3">
                  {[
                    { name: "Computer Science 101", percent: 96, color: "bg-neutral-900" },
                    { name: "Data Structures", percent: 92, color: "bg-neutral-700" },
                    { name: "Web Development", percent: 88, color: "bg-neutral-500" },
                  ].map((course, i) => (
                    <div key={i} className="space-y-1">
                      <div className="flex justify-between text-xs sm:text-sm">
                        <span className="text-neutral-600 truncate pr-2">{course.name}</span>
                        <span className="font-medium">{course.percent}%</span>
                      </div>
                      <div className="h-1.5 sm:h-2 bg-neutral-100 rounded-full overflow-hidden">
                        <div 
                          className={`h-full ${course.color} rounded-full transition-all duration-1000 ease-out`}
                          style={{ width: isInView ? `${course.percent}%` : "0%", transitionDelay: `${i * 200}ms` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Floating Card - Top Right */}
              <div className="absolute -top-2 sm:top-0 -right-2 sm:right-0 bg-white rounded-lg sm:rounded-xl shadow-xl border border-neutral-200/50 p-3 sm:p-4 z-30 animate-float hidden sm:block">
                <div className="flex items-center gap-2 sm:gap-3">
                  <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-md sm:rounded-lg bg-blue-100 flex items-center justify-center">
                    <Wifi className="w-4 h-4 sm:w-5 sm:h-5 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-xs sm:text-sm font-medium">Real-time Sync</p>
                    <p className="text-[10px] sm:text-xs text-neutral-500">All devices updated</p>
                  </div>
                </div>
              </div>

              {/* Floating Card - Bottom Left */}
              <div className="absolute -bottom-2 sm:bottom-4 -left-2 sm:left-0 bg-white rounded-lg sm:rounded-xl shadow-xl border border-neutral-200/50 p-3 sm:p-4 z-30 animate-float hidden sm:block" style={{ animationDelay: "1s" }}>
                <div className="flex items-center gap-2 sm:gap-3">
                  <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-md sm:rounded-lg bg-amber-100 flex items-center justify-center">
                    <WifiOff className="w-4 h-4 sm:w-5 sm:h-5 text-amber-600" />
                  </div>
                  <div>
                    <p className="text-xs sm:text-sm font-medium">Offline Ready</p>
                    <p className="text-[10px] sm:text-xs text-neutral-500">Works anywhere</p>
                  </div>
                </div>
              </div>

              {/* Background Decorative Elements */}
              <div className="absolute top-1/4 -left-4 sm:-left-8 w-12 h-12 sm:w-16 sm:h-16 rounded-xl sm:rounded-2xl bg-neutral-900/5 rotate-12 hidden lg:block" />
              <div className="absolute bottom-1/4 -right-4 sm:-right-8 w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-neutral-900/5 hidden lg:block" />
            </div>
          </div>
        </div>

        {/* Scroll Indicator - Hidden on mobile */}
        <div className="hidden sm:flex absolute bottom-8 left-1/2 -translate-x-1/2 flex-col items-center gap-2 animate-bounce">
          <span className="text-xs text-neutral-400">Scroll to explore</span>
          <ChevronDown className="w-5 h-5 text-neutral-400" />
        </div>
      </div>
    </section>
  );
}

// Problem vs Solution Section
function ProblemSolutionSection() {
  const { ref, isInView } = useInView();

  return (
    <section className="relative py-16 sm:py-20 lg:py-24 bg-neutral-900 text-white overflow-hidden">
      {/* Background Pattern */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff08_1px,transparent_1px),linear-gradient(to_bottom,#ffffff08_1px,transparent_1px)] bg-[size:4rem_4rem]" />

      <div ref={ref} className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className={`text-center mb-10 sm:mb-12 lg:mb-16 transition-all duration-700 ${isInView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-10"}`}>
          <h2 className="text-2xl sm:text-3xl lg:text-4xl xl:text-5xl font-bold mb-4 sm:mb-6 px-4">
            The Old Way vs. The New Way
          </h2>
          <p className="text-base sm:text-lg text-neutral-400 max-w-2xl mx-auto px-4">
            See how Attendance Hub transforms the entire attendance management experience
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 sm:gap-8">
          {/* Old Way */}
          <div className={`transition-all duration-700 ${isInView ? "opacity-100 translate-x-0" : "opacity-0 -translate-x-10"}`} style={{ transitionDelay: "200ms" }}>
            <div className="relative bg-white/5 backdrop-blur-sm rounded-2xl sm:rounded-3xl border border-white/10 p-6 sm:p-8 lg:p-10 h-full">
              <div className="absolute top-4 right-4 sm:top-6 sm:right-6 px-2.5 py-1 sm:px-3 sm:py-1 rounded-full bg-red-500/20 text-red-400 text-[10px] sm:text-xs font-medium whitespace-nowrap">
                Traditional Method
              </div>
              <h3 className="text-xl sm:text-2xl font-bold mb-6 sm:mb-8 text-neutral-300 pt-6 sm:pt-0">Without Attendance Hub</h3>
              <ul className="space-y-4 sm:space-y-6">
                {[
                  { icon: Clock, text: "Manual roll calls taking 10+ minutes per class" },
                  { icon: X, text: "Paper registers prone to errors and damage" },
                  { icon: X, text: "No real-time visibility for administrators" },
                  { icon: X, text: "Hours spent compiling monthly reports" },
                  { icon: X, text: "Impossible to track patterns and trends" },
                ].map((item, i) => (
                  <li key={i} className="flex items-start gap-3 sm:gap-4">
                    <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-lg sm:rounded-xl bg-red-500/10 flex items-center justify-center shrink-0">
                      <item.icon className="w-4 h-4 sm:w-5 sm:h-5 text-red-400" />
                    </div>
                    <span className="text-sm sm:text-base text-neutral-300 pt-1.5 sm:pt-2">{item.text}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* New Way */}
          <div className={`transition-all duration-700 ${isInView ? "opacity-100 translate-x-0" : "opacity-0 translate-x-10"}`} style={{ transitionDelay: "400ms" }}>
            <div className="relative bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-sm rounded-2xl sm:rounded-3xl border border-white/20 p-6 sm:p-8 lg:p-10 h-full">
              <div className="absolute top-4 right-4 sm:top-6 sm:right-6 px-2.5 py-1 sm:px-3 sm:py-1 rounded-full bg-green-500/20 text-green-400 text-[10px] sm:text-xs font-medium whitespace-nowrap">
                Modern Solution
              </div>
              <h3 className="text-xl sm:text-2xl font-bold mb-6 sm:mb-8 pt-6 sm:pt-0">With Attendance Hub</h3>
              <ul className="space-y-4 sm:space-y-6">
                {[
                  { icon: Zap, text: "Mark attendance in under 30 seconds" },
                  { icon: CheckCircle2, text: "Digital records that never get lost" },
                  { icon: CheckCircle2, text: "Live dashboards for instant oversight" },
                  { icon: CheckCircle2, text: "Automatic reports generated instantly" },
                  { icon: CheckCircle2, text: "AI-powered analytics and predictions" },
                ].map((item, i) => (
                  <li key={i} className="flex items-start gap-3 sm:gap-4">
                    <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-lg sm:rounded-xl bg-green-500/20 flex items-center justify-center shrink-0">
                      <item.icon className="w-4 h-4 sm:w-5 sm:h-5 text-green-400" />
                    </div>
                    <span className="text-sm sm:text-base text-white pt-1.5 sm:pt-2">{item.text}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

// Features Section - Bento Grid
function FeaturesSection() {
  const { ref, isInView } = useInView();

  const features = [
    {
      icon: WifiOff,
      title: "Offline-First Architecture",
      description: "Continue marking attendance even without internet. All data syncs automatically when you're back online.",
      className: "lg:col-span-2",
      highlight: true,
    },
    {
      icon: RefreshCw,
      title: "Real-Time Sync",
      description: "Changes reflect instantly across all devices. Everyone sees the same data, always.",
      className: "lg:col-span-1",
    },
    {
      icon: Building2,
      title: "Multi-Tenant",
      description: "Perfect for universities with multiple departments. Complete data isolation guaranteed.",
      className: "lg:col-span-1",
    },
    {
      icon: BarChart3,
      title: "Advanced Analytics",
      description: "Visual dashboards showing attendance trends, patterns, and predictions to help improve outcomes.",
      className: "lg:col-span-1",
    },
    {
      icon: Lock,
      title: "Enterprise Security",
      description: "Role-based access control, encrypted data, and audit logs. Your data stays safe and compliant.",
      className: "lg:col-span-1",
    },
    {
      icon: Shield,
      title: "Role-Based Access",
      description: "Different views and permissions for admins, teachers, and class representatives.",
      className: "lg:col-span-2",
      highlight: true,
    },
  ];

  return (
    <section id="features" className="relative py-24 lg:py-32 bg-gradient-to-b from-neutral-50 to-white overflow-hidden">
      <div ref={ref} className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className={`text-center mb-16 lg:mb-20 transition-all duration-700 ${isInView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-10"}`}>
          <span className="inline-block px-4 py-2 rounded-full bg-neutral-100 text-sm font-medium text-neutral-600 mb-6">
            Powerful Features
          </span>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-neutral-900 mb-6">
            Everything You Need,
            <br />
            Nothing You Don&apos;t
          </h2>
          <p className="text-lg text-neutral-600 max-w-2xl mx-auto">
            Built for the real challenges of academic attendance management
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 lg:gap-6">
          {features.map((feature, i) => (
            <div
              key={i}
              className={`
                ${feature.className}
                transition-all duration-700
                ${isInView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-10"}
              `}
              style={{ transitionDelay: `${i * 100}ms` }}
            >
              <div
                className={`
                  h-full rounded-3xl p-8 lg:p-10 transition-all duration-300 hover:shadow-xl
                  ${feature.highlight
                    ? "bg-neutral-900 text-white"
                    : "bg-white border border-neutral-200 hover:border-neutral-300"
                  }
                `}
              >
                <div
                  className={`
                    w-14 h-14 rounded-2xl flex items-center justify-center mb-6
                    ${feature.highlight ? "bg-white/10" : "bg-neutral-100"}
                  `}
                >
                  <feature.icon className={`w-7 h-7 ${feature.highlight ? "text-white" : "text-neutral-700"}`} />
                </div>
                <h3 className={`text-xl font-bold mb-3 ${feature.highlight ? "text-white" : "text-neutral-900"}`}>
                  {feature.title}
                </h3>
                <p className={`leading-relaxed ${feature.highlight ? "text-neutral-300" : "text-neutral-600"}`}>
                  {feature.description}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// How It Works Section
function HowItWorksSection() {
  const { ref, isInView } = useInView();

  const steps = [
    {
      number: "01",
      title: "Set Up Your Institution",
      description: "Create your university account, add departments, and configure your academic structure in minutes.",
      icon: Building2,
    },
    {
      number: "02",
      title: "Invite Your Team",
      description: "Add administrators, teachers, and class representatives with appropriate access levels.",
      icon: Users,
    },
    {
      number: "03",
      title: "Start Tracking",
      description: "Begin marking attendance instantly. Data syncs in real-time across all devices.",
      icon: UserCheck,
    },
  ];

  return (
    <section id="how-it-works" className="relative py-24 lg:py-32 bg-white overflow-hidden">
      <div ref={ref} className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className={`text-center mb-16 lg:mb-20 transition-all duration-700 ${isInView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-10"}`}>
          <span className="inline-block px-4 py-2 rounded-full bg-neutral-100 text-sm font-medium text-neutral-600 mb-6">
            Simple Setup
          </span>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-neutral-900 mb-6">
            Up and Running in Minutes
          </h2>
          <p className="text-lg text-neutral-600 max-w-2xl mx-auto">
            No complex training required. Start managing attendance the same day.
          </p>
        </div>

        <div className="relative">
          {/* Connection Line - Desktop */}
          <div className="hidden lg:block absolute top-14 left-[20%] right-[20%] h-px bg-gradient-to-r from-transparent via-neutral-300 to-transparent" />

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-12 lg:gap-8">
            {steps.map((step, i) => (
              <div
                key={i}
                className={`relative transition-all duration-700 ${isInView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-10"}`}
                style={{ transitionDelay: `${i * 200}ms` }}
              >
                <div className="text-center">
                  {/* Step Number Badge - Above the circle */}
                  <div className="flex justify-center mb-4">
                    <span className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-neutral-100 text-sm font-bold text-neutral-900 border border-neutral-200">
                      {step.number}
                    </span>
                  </div>

                  {/* Icon Circle */}
                  <div className="flex justify-center mb-6">
                    <div className="w-20 h-20 rounded-full bg-neutral-900 flex items-center justify-center shadow-xl shadow-neutral-900/20">
                      <step.icon className="w-8 h-8 text-white" />
                    </div>
                  </div>

                  <h3 className="text-xl font-bold text-neutral-900 mb-4">
                    {step.title}
                  </h3>
                  <p className="text-neutral-600 leading-relaxed max-w-xs mx-auto">
                    {step.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

// Roles Section - Compact Orbital Design
function RolesSection() {
  const { ref, isInView } = useInView();
  const [activeRole, setActiveRole] = useState(0);

  const roles = [
    {
      title: "Super Admin",
      fullTitle: "Super Administrators",
      description: "Complete system control with global oversight and analytics",
      icon: Shield,
      position: 0,
    },
    {
      title: "Department Admin",
      fullTitle: "Department Administrators", 
      description: "Manage department branches, sections, subjects, and teacher assignments",
      icon: Building2,
      position: 1,
    },
    {
      title: "Teachers",
      fullTitle: "Teachers",
      description: "Quick attendance marking with offline support and section oversight",
      icon: GraduationCap,
      position: 2,
    },
    {
      title: "Class Reps",
      fullTitle: "Class Representatives",
      description: "Assist with attendance marking for their designated section",
      icon: Users,
      position: 3,
    },
  ];

  return (
    <section id="roles" className="relative py-20 sm:py-24 lg:py-32 overflow-hidden bg-neutral-900">
      {/* Subtle Background */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff04_1px,transparent_1px),linear-gradient(to_bottom,#ffffff04_1px,transparent_1px)] bg-[size:4rem_4rem]" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-neutral-800/20 via-transparent to-transparent" />
      
      {/* Minimal gradient orbs */}
      <div className="absolute top-1/3 left-1/4 w-96 h-96 bg-gradient-to-br from-white/3 to-transparent rounded-full blur-3xl" />
      <div className="absolute bottom-1/3 right-1/4 w-96 h-96 bg-gradient-to-tl from-white/3 to-transparent rounded-full blur-3xl" />

      <div ref={ref} className="relative max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Compact Header */}
        <div className={`text-center mb-12 sm:mb-16 transition-all duration-1000 ${isInView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-10"}`}>
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 border border-white/10 text-xs text-neutral-400 mb-6 backdrop-blur-sm">
            <Lock className="w-3 h-3" />
            Role-Based Access
          </div>
          
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white mb-4 leading-tight">
            Built for
            <br />
            <span className="bg-gradient-to-r from-white via-neutral-400 to-white bg-clip-text text-transparent">
              Every Team Member
            </span>
          </h2>
          <p className="text-base sm:text-lg text-neutral-400 max-w-xl mx-auto">
            Precise permissions for every role in your institution
          </p>
        </div>

        {/* Compact Orbital Visualization */}
        <div className={`transition-all duration-1000 ${isInView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-10"}`} style={{ transitionDelay: "200ms" }}>
          
          {/* Central Hub */}
          <div className="relative max-w-4xl mx-auto">
            
            {/* Connection Lines - Desktop only */}
            <div className="hidden lg:block absolute inset-0">
              <svg className="w-full h-full" viewBox="0 0 800 400" fill="none">
                <line x1="400" y1="200" x2="150" y2="100" stroke="rgba(255,255,255,0.1)" strokeWidth="1" strokeDasharray="4 4" />
                <line x1="400" y1="200" x2="650" y2="100" stroke="rgba(255,255,255,0.1)" strokeWidth="1" strokeDasharray="4 4" />
                <line x1="400" y1="200" x2="150" y2="300" stroke="rgba(255,255,255,0.1)" strokeWidth="1" strokeDasharray="4 4" />
                <line x1="400" y1="200" x2="650" y2="300" stroke="rgba(255,255,255,0.1)" strokeWidth="1" strokeDasharray="4 4" />
              </svg>
            </div>

            {/* Role Cards in Grid */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-8">
              {roles.map((role, i) => {
                const Icon = role.icon;
                const isActive = activeRole === i;
                
                return (
                  <button
                    key={i}
                    onClick={() => setActiveRole(i)}
                    className={`group relative overflow-hidden rounded-xl border transition-all duration-500 ${
                      isActive 
                        ? "bg-white border-white shadow-2xl scale-105" 
                        : "bg-white/5 border-white/10 hover:bg-white/10 hover:border-white/20 hover:scale-105"
                    }`}
                  >
                    <div className="p-4 sm:p-5 text-center">
                      {/* Icon */}
                      <div className={`w-12 h-12 sm:w-14 sm:h-14 mx-auto rounded-xl flex items-center justify-center mb-3 transition-all duration-500 ${
                        isActive 
                          ? "bg-neutral-900 shadow-xl" 
                          : "bg-white/10"
                      }`}>
                        <Icon className={`w-6 h-6 sm:w-7 sm:h-7 transition-colors duration-500 ${isActive ? "text-white" : "text-neutral-400"}`} />
                      </div>
                      
                      {/* Title */}
                      <h3 className={`text-sm sm:text-base font-bold transition-colors duration-500 ${isActive ? "text-neutral-900" : "text-white"}`}>
                        {role.title}
                      </h3>
                    </div>

                    {/* Active indicator */}
                    <div className={`absolute bottom-0 left-0 h-1 bg-neutral-900 transition-all duration-500 ${
                      isActive ? "w-full" : "w-0"
                    }`} />
                  </button>
                );
              })}
            </div>

            {/* Active Role Details - Compact */}
            <div className="bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-sm rounded-2xl border border-white/10 p-6 sm:p-8 transition-all duration-500">
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 sm:gap-6">
                {/* Icon */}
                <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-xl bg-white flex items-center justify-center shadow-xl shrink-0">
                  {(() => {
                    const Icon = roles[activeRole].icon;
                    return <Icon className="w-8 h-8 sm:w-10 sm:h-10 text-neutral-900" />;
                  })()}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <h3 className="text-xl sm:text-2xl font-bold text-white mb-2">
                    {roles[activeRole].fullTitle}
                  </h3>
                  <p className="text-sm sm:text-base text-neutral-400 leading-relaxed">
                    {roles[activeRole].description}
                  </p>
                </div>

                {/* Security Badge */}
                <div className="hidden lg:flex items-center gap-3 bg-white/5 rounded-xl px-4 py-3 border border-white/10 shrink-0">
                  <Shield className="w-5 h-5 text-white" />
                  <div>
                    <p className="text-xs text-neutral-500">Protected by</p>
                    <p className="text-sm font-medium text-white">RLS</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

// Tech Stack Section - Visually Impressive Design
function TechStackSection() {
  const { ref, isInView } = useInView();

  const technologies = [
    {
      name: "Next.js 14",
      description: "React framework with App Router for blazing fast performance",
      category: "Frontend",
    },
    {
      name: "TypeScript",
      description: "Type-safe code that scales with your institution",
      category: "Language",
    },
    {
      name: "Supabase",
      description: "Real-time database, authentication, and storage",
      category: "Backend",
    },
    {
      name: "PostgreSQL",
      description: "Enterprise-grade relational database with RLS",
      category: "Database",
    },
    {
      name: "Dexie.js",
      description: "IndexedDB wrapper for offline-first architecture",
      category: "Storage",
    },
    {
      name: "Tailwind CSS",
      description: "Utility-first CSS for consistent, responsive design",
      category: "Styling",
    },
  ];

  return (
    <section className="relative py-16 sm:py-20 lg:py-24 overflow-hidden">
      {/* Background - matching hero style */}
      <div className="absolute inset-0 bg-gradient-to-b from-neutral-50 via-white to-neutral-50/50" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom,_var(--tw-gradient-stops))] from-neutral-100/50 via-transparent to-transparent" />
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#00000008_1px,transparent_1px),linear-gradient(to_bottom,#00000008_1px,transparent_1px)] bg-[size:4rem_4rem]" />
      
      {/* Floating Elements */}
      <div className="absolute top-1/3 left-[5%] w-48 h-48 sm:w-72 sm:h-72 bg-gradient-to-br from-neutral-200/40 to-transparent rounded-full blur-3xl animate-pulse" />
      <div className="absolute bottom-1/3 right-[5%] w-64 h-64 sm:w-96 sm:h-96 bg-gradient-to-tl from-neutral-200/30 to-transparent rounded-full blur-3xl animate-pulse" style={{ animationDelay: "1s" }} />

      <div ref={ref} className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 sm:gap-10 lg:gap-20 items-center">
          {/* Left Content */}
          <div className={`transition-all duration-1000 ${isInView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-10"}`}>
            {/* Badge */}
            <div className="inline-flex items-center gap-2 px-3 py-1.5 sm:px-4 sm:py-2 rounded-full bg-neutral-100 border border-neutral-200/50 text-xs sm:text-sm text-neutral-600 mb-6 sm:mb-8">
              <span className="w-2 h-2 rounded-full bg-neutral-900 animate-pulse" />
              Modern Architecture
            </div>

            {/* Main Headline */}
            <h2 className="text-2xl sm:text-3xl lg:text-4xl xl:text-5xl font-bold tracking-tight text-neutral-900 leading-[1.1] mb-4 sm:mb-6">
              Built on
              <br />
              <span className="bg-gradient-to-r from-neutral-900 via-neutral-600 to-neutral-900 bg-clip-text text-transparent">
                Modern Stack
              </span>
            </h2>

            <p className="text-base sm:text-lg lg:text-xl text-neutral-600 leading-relaxed mb-8 sm:mb-10 max-w-xl">
              We use cutting-edge technologies to deliver a fast, reliable, and secure platform 
              that scales with your institution.
            </p>

            {/* Key highlights */}
            <div className="grid grid-cols-2 gap-3 sm:gap-4">
              {[
                { label: "Response Time", value: "<100ms" },
                { label: "Offline Support", value: "100%" },
                { label: "Data Encryption", value: "256-bit" },
                { label: "Uptime SLA", value: "99.9%" },
              ].map((item, i) => (
                <div 
                  key={i}
                  className="bg-white rounded-xl border border-neutral-200/50 p-3 sm:p-4 shadow-sm hover:shadow-md transition-all duration-300"
                >
                  <p className="text-xl sm:text-2xl font-bold text-neutral-900">{item.value}</p>
                  <p className="text-xs sm:text-sm text-neutral-500">{item.label}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Right Content - Tech Stack Cards */}
          <div className={`relative transition-all duration-1000 ${isInView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-10"}`} style={{ transitionDelay: "300ms" }}>
            <div className="relative pt-10 sm:pt-16 lg:pt-12 pb-4 sm:pb-8 lg:pb-12">
              {/* Main floating card container */}
              <div className="bg-white rounded-xl sm:rounded-2xl shadow-2xl border border-neutral-200/50 p-4 sm:p-6 lg:p-8">
                <div className="flex items-center justify-between mb-4 sm:mb-6">
                  <div>
                    <p className="text-xs sm:text-sm text-neutral-500">Technology Stack</p>
                    <p className="text-lg sm:text-2xl font-bold">Enterprise Grade</p>
                  </div>
                  <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-lg sm:rounded-xl bg-neutral-900 flex items-center justify-center">
                    <Zap className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
                  </div>
                </div>

                <div className="space-y-2 sm:space-y-3">
                  {technologies.map((tech, i) => (
                    <div 
                      key={i}
                      className={`group flex items-center gap-3 sm:gap-4 p-3 sm:p-4 rounded-lg sm:rounded-xl bg-neutral-50 border border-neutral-100 hover:bg-white hover:shadow-md hover:border-neutral-200 transition-all duration-300 ${
                        isInView ? "opacity-100 translate-x-0" : "opacity-0 translate-x-10"
                      }`}
                      style={{ transitionDelay: `${400 + i * 100}ms` }}
                    >
                      <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-lg bg-neutral-900 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform duration-300">
                        <span className="text-white font-bold text-xs sm:text-sm">{tech.name.charAt(0)}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                          <p className="font-semibold text-sm sm:text-base text-neutral-900">{tech.name}</p>
                          <span className="px-1.5 py-0.5 sm:px-2 sm:py-0.5 rounded-full bg-neutral-200 text-[10px] sm:text-xs text-neutral-600 whitespace-nowrap">
                            {tech.category}
                          </span>
                        </div>
                        <p className="text-xs sm:text-sm text-neutral-500 truncate">{tech.description}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Floating accent card - top right - Hidden on mobile */}
              <div className="hidden lg:block absolute top-0 right-8 bg-white rounded-xl shadow-xl border border-neutral-200/50 p-4 z-10 animate-float">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center">
                    <CheckCircle2 className="w-5 h-5 text-green-600" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">Production Ready</p>
                    <p className="text-xs text-neutral-500">Battle tested</p>
                  </div>
                </div>
              </div>

              {/* Background decorative elements */}
              <div className="absolute top-1/4 -left-4 sm:-left-8 w-12 h-12 sm:w-16 sm:h-16 rounded-xl sm:rounded-2xl bg-neutral-900/5 rotate-12 hidden lg:block" />
              <div className="absolute bottom-1/4 -right-4 sm:-right-8 w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-neutral-900/5 hidden lg:block" />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

// CTA Section
function CTASection() {
  const { ref, isInView } = useInView();

  return (
    <section className="relative py-24 lg:py-32 overflow-hidden">
      <div className="absolute inset-0 bg-neutral-900" />
      <div className="absolute inset-0 bg-gradient-to-br from-neutral-800 via-neutral-900 to-black" />
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff08_1px,transparent_1px),linear-gradient(to_bottom,#ffffff08_1px,transparent_1px)] bg-[size:4rem_4rem]" />

      {/* Decorative Elements */}
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-gradient-to-br from-white/5 to-transparent rounded-full blur-3xl" />
      <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-gradient-to-tl from-white/5 to-transparent rounded-full blur-3xl" />

      <div ref={ref} className="relative max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <div className={`transition-all duration-700 ${isInView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-10"}`}>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl xl:text-6xl font-bold text-white mb-6 leading-tight">
            Ready to Transform Your
            <br />
            Attendance Management?
          </h2>
          <p className="text-lg sm:text-xl text-neutral-400 mb-10 max-w-2xl mx-auto">
            Join hundreds of universities already using Attendance Hub to streamline their academic operations.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/register">
              <Button size="lg" className="w-full sm:w-auto text-base px-8 py-6 bg-white text-neutral-900 hover:bg-neutral-100 shadow-xl hover:shadow-2xl transition-all duration-300">
                Register Now
                <ArrowRight className="w-5 h-5 ml-2" />
              </Button>
            </Link>
            <Link href="/login">
              <Button size="lg" className="w-full sm:w-auto text-base px-8 py-6 bg-white/10 text-white border border-white/30 hover:bg-white/20 hover:border-white/50 transition-all duration-300">
                Sign In
              </Button>
            </Link>
          </div>

          <p className="text-sm text-neutral-500 mt-8">
            No credit card required. Cancel anytime.
          </p>
        </div>
      </div>
    </section>
  );
}

// Footer
function Footer() {
  return (
    <footer className="bg-neutral-900 border-t border-neutral-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 lg:py-16">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 lg:gap-12 mb-12">
          <div className="col-span-2 md:col-span-1">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center">
                <GraduationCap className="w-5 h-5 text-neutral-900" />
              </div>
              <span className="text-lg font-semibold text-white">Attendance Hub</span>
            </div>
            <p className="text-neutral-400 text-sm leading-relaxed">
              Modern attendance management for educational institutions worldwide.
            </p>
          </div>

          <div>
            <h4 className="text-white font-semibold mb-4">Product</h4>
            <ul className="space-y-3 text-sm">
              <li><a href="#features" className="text-neutral-400 hover:text-white transition-colors">Features</a></li>
              <li><a href="#how-it-works" className="text-neutral-400 hover:text-white transition-colors">How It Works</a></li>
              <li><a href="#roles" className="text-neutral-400 hover:text-white transition-colors">For Teams</a></li>
            </ul>
          </div>

          <div>
            <h4 className="text-white font-semibold mb-4">Account</h4>
            <ul className="space-y-3 text-sm">
              <li><Link href="/login" className="text-neutral-400 hover:text-white transition-colors">Sign In</Link></li>
              <li><Link href="/register" className="text-neutral-400 hover:text-white transition-colors">Get Started</Link></li>
              <li><Link href="/forgot-password" className="text-neutral-400 hover:text-white transition-colors">Reset Password</Link></li>
            </ul>
          </div>

          <div>
            <h4 className="text-white font-semibold mb-4">Legal</h4>
            <ul className="space-y-3 text-sm">
              <li><a href="#" className="text-neutral-400 hover:text-white transition-colors">Privacy Policy</a></li>
              <li><a href="#" className="text-neutral-400 hover:text-white transition-colors">Terms of Service</a></li>
              <li><a href="#" className="text-neutral-400 hover:text-white transition-colors">Cookie Policy</a></li>
            </ul>
          </div>
        </div>

        <div className="pt-8 border-t border-neutral-800 flex flex-col sm:flex-row justify-between items-center gap-4">
          <p className="text-neutral-500 text-sm">
            2026 Attendance Hub. All rights reserved.
          </p>
          <div className="flex items-center gap-6">
            <a href="#" className="text-neutral-400 hover:text-white transition-colors text-sm">Support</a>
            <a href="#" className="text-neutral-400 hover:text-white transition-colors text-sm">Contact</a>
            <a href="#" className="text-neutral-400 hover:text-white transition-colors text-sm">Status</a>
          </div>
        </div>
      </div>
    </footer>
  );
}

// Main Landing Page Component
export default function LandingPage() {
  return (
    <main className="min-h-screen bg-white scroll-smooth">
      <Navigation />
      <HeroSection />
      <ProblemSolutionSection />
      <FeaturesSection />
      <HowItWorksSection />
      <RolesSection />
      <TechStackSection />
      <CTASection />
      <Footer />
    </main>
  );
}
