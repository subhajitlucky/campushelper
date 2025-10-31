'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { ReactNode, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import React from 'react';

interface PageTransitionProps {
  children: ReactNode;
  mode?: 'fade' | 'slide' | 'scale' | 'slideUp';
  duration?: number;
  className?: string;
}

const pageVariants = {
  fade: {
    initial: { opacity: 0 },
    animate: { opacity: 1 },
    exit: { opacity: 0 }
  },
  slide: {
    initial: { x: '100%', opacity: 0 },
    animate: { x: 0, opacity: 1 },
    exit: { x: '-100%', opacity: 0 }
  },
  slideUp: {
    initial: { y: '100%', opacity: 0 },
    animate: { y: 0, opacity: 1 },
    exit: { y: '-100%', opacity: 0 }
  },
  scale: {
    initial: { scale: 0.8, opacity: 0 },
    animate: { scale: 1, opacity: 1 },
    exit: { scale: 1.2, opacity: 0 }
  }
};

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      duration: 0.3,
      staggerChildren: 0.1
    }
  },
  exit: {
    opacity: 0,
    transition: {
      duration: 0.2
    }
  }
};

const itemVariants = {
  hidden: { y: 20, opacity: 0 },
  visible: {
    y: 0,
    opacity: 1,
    transition: {
      duration: 0.4,
      ease: [0.04, 0.62, 0.23, 0.98] as const
    }
  }
};

export function PageTransition({ 
  children, 
  mode = 'fade', 
  duration = 0.3,
  className = '' 
}: PageTransitionProps) {
  const pathname = usePathname();

  // Ensure children is a single valid React element
  const childElement = React.isValidElement(children) 
    ? children 
    : React.createElement('div', null, children);

  return (
    <AnimatePresence mode="wait" key={pathname}>
      <motion.div
        className={className}
        initial="initial"
        animate="animate"
        exit="exit"
        variants={pageVariants[mode]}
        transition={{
          duration,
          ease: [0.04, 0.62, 0.23, 0.98] as const
        }}
      >
        {childElement}
      </motion.div>
    </AnimatePresence>
  );
}

interface StaggerContainerProps {
  children: ReactNode;
  className?: string;
  delay?: number;
}

export function StaggerContainer({ 
  children, 
  className = '',
  delay = 0 
}: StaggerContainerProps) {
  return (
    <motion.div
      className={className}
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      exit="exit"
    >
      {children}
    </motion.div>
  );
}

interface StaggerItemProps {
  children: ReactNode;
  className?: string;
  delay?: number;
}

export function StaggerItem({ 
  children, 
  className = '',
  delay = 0 
}: StaggerItemProps) {
  return (
    <motion.div
      className={className}
      variants={{ ...itemVariants, visible: { ...itemVariants.visible, transition: { ...itemVariants.visible.transition, delay } } }}
    >
      {children}
    </motion.div>
  );
}

interface AnimatedSectionProps {
  children: ReactNode;
  className?: string;
  delay?: number;
  direction?: 'up' | 'down' | 'left' | 'right' | 'scale';
}

const directionVariants = {
  up: { hidden: { y: 50, opacity: 0 }, visible: { y: 0, opacity: 1 } },
  down: { hidden: { y: -50, opacity: 0 }, visible: { y: 0, opacity: 1 } },
  left: { hidden: { x: -50, opacity: 0 }, visible: { x: 0, opacity: 1 } },
  right: { hidden: { x: 50, opacity: 0 }, visible: { x: 0, opacity: 1 } },
  scale: { hidden: { scale: 0.8, opacity: 0 }, visible: { scale: 1, opacity: 1 } }
};

export function AnimatedSection({ 
  children, 
  className = '',
  delay = 0,
  direction = 'up'
}: AnimatedSectionProps) {
  return (
    <motion.div
      className={className}
      variants={directionVariants[direction]}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, amount: 0.3 }}
      transition={{
        duration: 0.6,
        delay,
        ease: [0.04, 0.62, 0.23, 0.98] as const
      }}
    >
      {children}
    </motion.div>
  );
}

interface FadeInViewProps {
  children: ReactNode;
  className?: string;
  delay?: number;
  duration?: number;
}

export function FadeInView({ 
  children, 
  className = '',
  delay = 0,
  duration = 0.6 
}: FadeInViewProps) {
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{
        duration,
        delay,
        ease: [0.04, 0.62, 0.23, 0.98] as const
      }}
    >
      {children}
    </motion.div>
  );
}

interface HoverEffectProps {
  children: ReactNode;
  className?: string;
  effect?: 'scale' | 'lift' | 'glow' | 'tilt';
  scale?: number;
  lift?: number;
  glow?: string;
}

const hoverEffects = {
  scale: { scale: 1.05 },
  lift: { y: -8, boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)' },
  glow: { boxShadow: '0 0 20px rgba(59, 130, 246, 0.5)' },
  tilt: { rotateX: 5, rotateY: 5 }
};

export function HoverEffect({ 
  children, 
  className = '',
  effect = 'scale',
  scale = 1.05,
  lift = -8,
  glow = '0 0 20px rgba(59, 130, 246, 0.5)'
}: HoverEffectProps) {
  const baseEffect = hoverEffects[effect];
  
  return (
    <motion.div
      className={className}
      whileHover={baseEffect}
      whileTap={{ scale: 0.98 }}
      transition={{
        type: "spring",
        stiffness: 400,
        damping: 17
      }}
    >
      {children}
    </motion.div>
  );
}

interface ButtonAnimationProps {
  children: ReactNode;
  className?: string;
  variant?: 'bounce' | 'pulse' | 'ripple' | 'shine';
  onClick?: () => void;
}

export function ButtonAnimation({ 
  children, 
  className = '',
  variant = 'bounce',
  onClick 
}: ButtonAnimationProps) {
  const variants = {
    bounce: {
      whileTap: { scale: 0.95 },
      whileHover: { scale: 1.02 }
    },
    pulse: {
      whileTap: { scale: 0.95 },
      whileHover: { 
        scale: 1.05,
        boxShadow: '0 0 20px rgba(59, 130, 246, 0.3)'
      }
    },
    ripple: {
      whileTap: { scale: 0.95 },
      whileHover: { scale: 1.02 }
    },
    shine: {
      whileTap: { scale: 0.95 },
      whileHover: { 
        scale: 1.02,
        background: 'linear-gradient(45deg, transparent 30%, rgba(255,255,255,0.1) 50%, transparent 70%)'
      }
    }
  };

  return (
    <motion.button
      className={className}
      variants={variants[variant]}
      whileTap="whileTap"
      whileHover="whileHover"
      transition={{
        type: "spring",
        stiffness: 400,
        damping: 17
      }}
      onClick={onClick}
    >
      {children}
    </motion.button>
  );
}

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  color?: string;
  className?: string;
}

export function AnimatedSpinner({ 
  size = 'md', 
  color = 'currentColor',
  className = ''
}: LoadingSpinnerProps) {
  const sizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-6 h-6',
    lg: 'w-8 h-8'
  };

  return (
    <motion.div
      className={`${sizeClasses[size]} ${className}`}
      animate={{ rotate: 360 }}
      transition={{
        duration: 1,
        repeat: Infinity,
        ease: 'linear'
      }}
    >
      <svg
        className="w-full h-full"
        fill="none"
        viewBox="0 0 24 24"
        style={{ color }}
      >
        <circle
          className="opacity-25"
          cx="12"
          cy="12"
          r="10"
          stroke="currentColor"
          strokeWidth="4"
        />
        <path
          className="opacity-75"
          fill="currentColor"
          d="m4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
        />
      </svg>
    </motion.div>
  );
}
