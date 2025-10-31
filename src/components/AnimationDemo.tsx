'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { 
  PageTransition,
  StaggerContainer,
  StaggerItem,
  AnimatedSection,
  FadeInView,
  HoverEffect,
  ButtonAnimation,
  AnimatedSpinner
} from '@/components/ui/page-transition';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { 
  Home, 
  Settings, 
  User, 
  Bell, 
  Heart,
  Star,
  Zap,
  Sparkles,
  ChevronDown,
  ChevronRight
} from 'lucide-react';

export default function AnimationDemo() {
  const [activeTab, setActiveTab] = useState('page-transitions');
  const [showModal, setShowModal] = useState(false);
  const [showAccordion, setShowAccordion] = useState(false);
  const [rippleActive, setRippleActive] = useState(false);

  const navigationItems = [
    { icon: Home, label: 'Home', active: true },
    { icon: User, label: 'Profile', active: false },
    { icon: Settings, label: 'Settings', active: false },
    { icon: Bell, label: 'Notifications', active: false },
  ];

  const demoItems = Array.from({ length: 6 }, (_, i) => ({
    id: i + 1,
    title: `Animation Demo Item ${i + 1}`,
    description: 'This is a demo item showcasing smooth animations and transitions.',
    icon: Heart
  }));

  const triggerRipple = () => {
    setRippleActive(true);
    setTimeout(() => setRippleActive(false), 300);
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-4 bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
            Smooth Animations & Transitions Demo
          </h1>
          <p className="text-gray-600 text-lg">
            Comprehensive demonstration of page transitions, hover effects, and smooth animations
          </p>
        </div>

        {/* Navigation Demo */}
        <FadeInView delay={0.1}>
          <Card className="mb-8 shadow-colored">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Zap className="w-5 h-5 text-blue-600" />
                Navigation with Hover Effects
              </CardTitle>
              <CardDescription>Interactive navigation with smooth transitions</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex gap-2">
                {navigationItems.map((item, index) => {
                  const Icon = item.icon;
                  return (
                    <HoverEffect key={item.label} effect="lift" className="flex-1">
                      <Button
                        variant={item.active ? "default" : "outline"}
                        className={`w-full nav-item ${item.active ? 'active' : ''} ripple`}
                        onClick={triggerRipple}
                      >
                        <Icon className="w-4 h-4 mr-2" />
                        {item.label}
                      </Button>
                    </HoverEffect>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </FadeInView>

        {/* Animation Tabs */}
        <FadeInView delay={0.2}>
          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
            <TabsList className="grid w-full grid-cols-5">
              <TabsTrigger value="page-transitions">Page Transitions</TabsTrigger>
              <TabsTrigger value="button-effects">Button Effects</TabsTrigger>
              <TabsTrigger value="hover-effects">Hover Effects</TabsTrigger>
              <TabsTrigger value="color-transitions">Color Transitions</TabsTrigger>
              <TabsTrigger value="complex-animations">Complex Animations</TabsTrigger>
            </TabsList>

            {/* Page Transitions */}
            <TabsContent value="page-transitions" className="space-y-6">
              <StaggerContainer className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Different Page Transition Modes</CardTitle>
                    <CardDescription>Experience smooth page-to-page transitions</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      {['fade', 'slide', 'slideUp', 'scale'].map((mode) => (
                        <StaggerItem key={mode} delay={0.1}>
                          <HoverEffect effect="scale">
                            <div className="p-4 border rounded-lg text-center bg-gradient-to-br from-blue-50 to-purple-50 hover:from-blue-100 hover:to-purple-100 transition-all duration-300">
                              <h3 className="font-semibold capitalize mb-2">{mode}</h3>
                              <p className="text-sm text-gray-600">
                                {mode === 'fade' && 'Opacity transition'}
                                {mode === 'slide' && 'Slide from right'}
                                {mode === 'slideUp' && 'Slide from bottom'}
                                {mode === 'scale' && 'Scale in/out'}
                              </p>
                            </div>
                          </HoverEffect>
                        </StaggerItem>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                <StaggerItem delay={0.2}>
                  <Card>
                    <CardHeader>
                      <CardTitle>Fade-in Animations on Load</CardTitle>
                      <CardDescription>Smooth content entrance animations</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {[
                          { title: 'Quick Fade', delay: 0, duration: 0.3 },
                          { title: 'Slide Up', delay: 0.1, duration: 0.5 },
                          { title: 'Scale In', delay: 0.2, duration: 0.4 }
                        ].map((animation, index) => (
                          <FadeInView
                            key={index}
                            delay={animation.delay}
                            duration={animation.duration}
                            className="p-4 border rounded-lg bg-white hover:bg-gray-50 transition-colors"
                          >
                            <h4 className="font-semibold mb-2">{animation.title}</h4>
                            <p className="text-sm text-gray-600">Smooth entrance animation</p>
                          </FadeInView>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                </StaggerItem>
              </StaggerContainer>
            </TabsContent>

            {/* Button Effects */}
            <TabsContent value="button-effects" className="space-y-6">
              <AnimatedSection direction="up">
                <Card>
                  <CardHeader>
                    <CardTitle>Enhanced Button Animations</CardTitle>
                    <CardDescription>Interactive button hover and click effects</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      {[
                        { variant: 'bounce', label: 'Bounce Effect', color: 'bg-blue-500' },
                        { variant: 'pulse', label: 'Pulse Glow', color: 'bg-green-500' },
                        { variant: 'ripple', label: 'Ripple Touch', color: 'bg-purple-500' },
                        { variant: 'shine', label: 'Shine Effect', color: 'bg-orange-500' }
                      ].map((button) => (
                        <HoverEffect key={button.variant} effect="scale">
                          <ButtonAnimation
                            variant={button.variant as any}
                            className={`w-full ${button.color} hover:opacity-90 text-white`}
                          >
                            {button.label}
                          </ButtonAnimation>
                        </HoverEffect>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </AnimatedSection>

              <AnimatedSection direction="up" delay={0.1}>
                <Card>
                  <CardHeader>
                    <CardTitle>Button with Loading States</CardTitle>
                    <CardDescription>Buttons with animated loading spinners</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div className="flex gap-4">
                        <HoverEffect effect="scale">
                          <Button className="btn-enhanced">
                            <AnimatedSpinner size="sm" className="mr-2" />
                            Loading...
                          </Button>
                        </HoverEffect>
                        <HoverEffect effect="scale">
                          <Button variant="outline" className="btn-enhanced">
                            <AnimatedSpinner size="md" className="mr-2 text-blue-600" />
                            Processing
                          </Button>
                        </HoverEffect>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </AnimatedSection>
            </TabsContent>

            {/* Hover Effects */}
            <TabsContent value="hover-effects" className="space-y-6">
              <StaggerContainer>
                <Card>
                  <CardHeader>
                    <CardTitle>Interactive Hover Effects</CardTitle>
                    <CardDescription>Various hover animation styles</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {[
                        { effect: 'scale', title: 'Scale Effect', description: 'Grows on hover' },
                        { effect: 'lift', title: 'Lift Effect', description: 'Moves up with shadow' },
                        { effect: 'glow', title: 'Glow Effect', description: 'Blue glow on hover' },
                        { effect: 'tilt', title: 'Tilt Effect', description: '3D tilt perspective' }
                      ].map((hoverEffect) => (
                        <StaggerItem key={hoverEffect.effect} delay={0.1}>
                          <HoverEffect effect={hoverEffect.effect as any}>
                            <div className="p-6 border rounded-lg bg-white hover:bg-gray-50 transition-colors">
                              <h4 className="font-semibold mb-2">{hoverEffect.title}</h4>
                              <p className="text-gray-600">{hoverEffect.description}</p>
                              <div className="mt-4 flex gap-2">
                                <Badge variant="secondary" className="text-xs">
                                  {hoverEffect.effect}
                                </Badge>
                                <Badge variant="outline" className="text-xs">
                                  Interactive
                                </Badge>
                              </div>
                            </div>
                          </HoverEffect>
                        </StaggerItem>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                <StaggerItem delay={0.2}>
                  <Card>
                    <CardHeader>
                      <CardTitle>Card Hover Animations</CardTitle>
                      <CardDescription>Enhanced card interactions</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {demoItems.slice(0, 3).map((item, index) => {
                          const Icon = item.icon;
                          return (
                            <HoverEffect key={item.id} effect="lift">
                              <motion.div
                                className="card-enhanced p-6 border rounded-lg bg-white"
                                whileHover={{ y: -8 }}
                                transition={{ type: "spring", stiffness: 300, damping: 20 }}
                              >
                                <div className="flex items-center gap-3 mb-3">
                                  <div className="p-2 bg-red-100 rounded-full">
                                    <Icon className="w-5 h-5 text-red-600" />
                                  </div>
                                  <h4 className="font-semibold">{item.title}</h4>
                                </div>
                                <p className="text-gray-600 text-sm">{item.description}</p>
                                <div className="mt-4 flex justify-between items-center">
                                  <Badge variant="outline" className="text-xs">Demo</Badge>
                                  <Heart className="w-4 h-4 text-gray-400 hover:text-red-500 cursor-pointer transition-colors" />
                                </div>
                              </motion.div>
                            </HoverEffect>
                          );
                        })}
                      </div>
                    </CardContent>
                  </Card>
                </StaggerItem>
              </StaggerContainer>
            </TabsContent>

            {/* Color Transitions */}
            <TabsContent value="color-transitions" className="space-y-6">
              <AnimatedSection direction="up">
                <Card>
                  <CardHeader>
                    <CardTitle>Smooth Color Transitions</CardTitle>
                    <CardDescription>Beautiful color transitions and gradients</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      {[
                        { from: 'from-blue-400', to: 'to-blue-600', label: 'Blue Gradient' },
                        { from: 'from-green-400', to: 'to-green-600', label: 'Green Gradient' },
                        { from: 'from-purple-400', to: 'to-purple-600', label: 'Purple Gradient' },
                        { from: 'from-pink-400', to: 'to-pink-600', label: 'Pink Gradient' }
                      ].map((gradient, index) => (
                        <HoverEffect key={index} effect="scale">
                          <motion.div
                            className={`h-24 rounded-lg bg-gradient-to-r ${gradient.from} ${gradient.to} flex items-center justify-center text-white font-semibold shadow-lg`}
                            whileHover={{ scale: 1.05, rotate: 2 }}
                            transition={{ type: "spring", stiffness: 300 }}
                          >
                            {gradient.label}
                          </motion.div>
                        </HoverEffect>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </AnimatedSection>

              <AnimatedSection direction="up" delay={0.1}>
                <Card>
                  <CardHeader>
                    <CardTitle>Interactive Color Changes</CardTitle>
                    <CardDescription>Smooth color transitions on interaction</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div className="flex gap-4 flex-wrap">
                        {['bg-blue-500', 'bg-green-500', 'bg-purple-500', 'bg-pink-500'].map((color, index) => (
                          <motion.div
                            key={index}
                            className={`w-16 h-16 ${color} rounded-lg cursor-pointer`}
                            whileHover={{ scale: 1.2, rotate: 10 }}
                            whileTap={{ scale: 0.9 }}
                            transition={{ type: "spring", stiffness: 400, damping: 10 }}
                          />
                        ))}
                      </div>
                      
                      <div className="space-y-3">
                        <label className="block text-sm font-medium">Interactive Input</label>
                        <Input
                          className="input-enhanced"
                          placeholder="Hover and focus to see smooth transitions"
                        />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </AnimatedSection>
            </TabsContent>

            {/* Complex Animations */}
            <TabsContent value="complex-animations" className="space-y-6">
              <StaggerContainer>
                <Card>
                  <CardHeader>
                    <CardTitle>Complex Animation Sequences</CardTitle>
                    <CardDescription>Advanced animations with multiple effects</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-6">
                      {/* Staggered Animation */}
                      <div>
                        <h4 className="font-semibold mb-4">Staggered Items Animation</h4>
                        <div className="stagger-container">
                          {demoItems.slice(0, 4).map((item, index) => {
                            const Icon = item.icon;
                            return (
                              <motion.div
                                key={item.id}
                                className="stagger-item p-4 border rounded-lg bg-white hover:bg-gray-50 transition-colors"
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: index * 0.1 }}
                              >
                                <div className="flex items-center gap-3">
                                  <motion.div
                                    className="p-2 bg-red-100 rounded-full"
                                    whileHover={{ scale: 1.2, rotate: 180 }}
                                    transition={{ type: "spring", stiffness: 300 }}
                                  >
                                    <Icon className="w-4 h-4 text-red-600" />
                                  </motion.div>
                                  <div>
                                    <h5 className="font-medium">{item.title}</h5>
                                    <p className="text-sm text-gray-600">{item.description}</p>
                                  </div>
                                </div>
                              </motion.div>
                            );
                          })}
                        </div>
                      </div>

                      {/* Accordion Animation */}
                      <div>
                        <HoverEffect effect="scale">
                          <Button
                            variant="outline"
                            onClick={() => setShowAccordion(!showAccordion)}
                            className="w-full justify-between ripple"
                          >
                            <span>Animated Accordion</span>
                            <motion.div
                              animate={{ rotate: showAccordion ? 180 : 0 }}
                              transition={{ duration: 0.3 }}
                            >
                              <ChevronDown className="w-4 h-4" />
                            </motion.div>
                          </Button>
                        </HoverEffect>
                        <motion.div
                          className={`accordion-content ${showAccordion ? 'open' : ''} mt-2 p-4 border rounded-lg bg-gray-50`}
                          initial={false}
                          animate={{ maxHeight: showAccordion ? 200 : 0 }}
                          transition={{ duration: 0.3, ease: "easeInOut" }}
                        >
                          <p className="text-gray-700">
                            This accordion smoothly expands and collapses with a beautiful animation. 
                            The height transitions smoothly using CSS transforms and max-height.
                          </p>
                        </motion.div>
                      </div>

                      {/* Modal Animation */}
                      <div>
                        <HoverEffect effect="scale">
                          <Button
                            onClick={() => setShowModal(true)}
                            className="w-full ripple"
                          >
                            <Sparkles className="w-4 h-4 mr-2" />
                            Open Animated Modal
                          </Button>
                        </HoverEffect>
                        
                        {showModal && (
                          <motion.div
                            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-50"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setShowModal(false)}
                          >
                            <motion.div
                              className="bg-white rounded-lg p-6 max-w-md w-full"
                              initial={{ scale: 0.5, opacity: 0 }}
                              animate={{ scale: 1, opacity: 1 }}
                              exit={{ scale: 0.5, opacity: 0 }}
                              transition={{ type: "spring", stiffness: 300, damping: 25 }}
                              onClick={(e) => e.stopPropagation()}
                            >
                              <h3 className="text-lg font-semibold mb-4">Animated Modal</h3>
                              <p className="text-gray-600 mb-4">
                                This modal uses complex Framer Motion animations for a smooth entrance and exit.
                              </p>
                              <div className="flex gap-2 justify-end">
                                <Button variant="outline" onClick={() => setShowModal(false)}>
                                  Cancel
                                </Button>
                                <Button onClick={() => setShowModal(false)}>
                                  Confirm
                                </Button>
                              </div>
                            </motion.div>
                          </motion.div>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <StaggerItem delay={0.2}>
                  <Card>
                    <CardHeader>
                      <CardTitle>Features Summary</CardTitle>
                      <CardDescription>What our animation system provides</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 text-sm">
                        <div className="space-y-2">
                          <h4 className="font-semibold text-blue-600">🎬 Page Transitions</h4>
                          <ul className="space-y-1 text-gray-600">
                            <li>• Fade in/out animations</li>
                            <li>• Slide transitions</li>
                            <li>• Scale effects</li>
                            <li>• Smooth route changes</li>
                          </ul>
                        </div>
                        <div className="space-y-2">
                          <h4 className="font-semibold text-green-600">🖱️ Hover Effects</h4>
                          <ul className="space-y-1 text-gray-600">
                            <li>• Scale on hover</li>
                            <li>• Lift with shadows</li>
                            <li>• Glow effects</li>
                            <li>• 3D tilt animations</li>
                          </ul>
                        </div>
                        <div className="space-y-2">
                          <h4 className="font-semibold text-purple-600">🎨 Color Transitions</h4>
                          <ul className="space-y-1 text-gray-600">
                            <li>• Smooth gradient changes</li>
                            <li>• Background transitions</li>
                            <li>• Text color animations</li>
                            <li>• Theme switching</li>
                          </ul>
                        </div>
                        <div className="space-y-2">
                          <h4 className="font-semibold text-orange-600">⚡ Button Effects</h4>
                          <ul className="space-y-1 text-gray-600">
                            <li>• Bounce animations</li>
                            <li>• Pulse glow effects</li>
                            <li>• Ripple interactions</li>
                            <li>• Shine animations</li>
                          </ul>
                        </div>
                        <div className="space-y-2">
                          <h4 className="font-semibold text-pink-600">🔄 Complex Animations</h4>
                          <ul className="space-y-1 text-gray-600">
                            <li>• Staggered sequences</li>
                            <li>• Accordion transitions</li>
                            <li>• Modal animations</li>
                            <li>• Loading states</li>
                          </ul>
                        </div>
                        <div className="space-y-2">
                          <h4 className="font-semibold text-indigo-600">🎯 Performance</h4>
                          <ul className="space-y-1 text-gray-600">
                            <li>• Hardware acceleration</li>
                            <li>• Reduced motion support</li>
                            <li>• Optimized animations</li>
                            <li>• Smooth 60fps</li>
                          </ul>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </StaggerItem>
              </StaggerContainer>
            </TabsContent>
          </Tabs>
        </FadeInView>
      </div>
  );
}
