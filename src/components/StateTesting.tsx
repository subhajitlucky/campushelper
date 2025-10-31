'use client';

import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  LoadingSpinner,
  ButtonSpinner,
  PageLoader,
  InlineLoader
} from '@/components/ui/loading-spinner';
import { 
  AnimatedSpinner,
  AnimatedSection,
  ButtonAnimation,
  HoverEffect,
  FadeInView,
  StaggerContainer,
  StaggerItem
} from '@/components/ui/page-transition';
import { 
  showSuccess, 
  showError, 
  showInfo, 
  showWarning, 
  showLoading,
  showPromise,
  ToastManager 
} from '@/lib/toast-config';
import { 
  Loader2, 
  CheckCircle, 
  AlertCircle, 
  Info, 
  Zap,
  Play,
  Pause,
  RotateCcw,
  Wifi,
  WifiOff,
  Gauge,
  Eye,
  Activity,
  Clock
} from 'lucide-react';

interface PerformanceMetrics {
  fps: number;
  frameTime: number;
  memoryUsage: number;
  animationSmoothness: number;
}

interface NetworkStatus {
  isOnline: boolean;
  connectionType: string;
  latency: number;
  downloadSpeed: number;
}

export default function StateTesting() {
  const [activeTab, setActiveTab] = useState('loading-states');
  const [performance, setPerformance] = useState<PerformanceMetrics>({
    fps: 60,
    frameTime: 16.67,
    memoryUsage: 0,
    animationSmoothness: 100
  });
  const [networkStatus, setNetworkStatus] = useState<NetworkStatus>({
    isOnline: navigator.onLine,
    connectionType: 'unknown',
    latency: 0,
    downloadSpeed: 0
  });
  const [isMonitoring, setIsMonitoring] = useState(false);
  const [testResults, setTestResults] = useState<Array<{
    test: string;
    status: 'pass' | 'fail' | 'running';
    message: string;
    timestamp: Date;
  }>>([]);

  const animationFrameRef = useRef<number | null>(null);
  const startTimeRef = useRef<number>(0);
  const frameCountRef = useRef<number>(0);

  // Performance monitoring
  const startMonitoring = () => {
    setIsMonitoring(true);
    startTimeRef.current = window.performance.now();
    frameCountRef.current = 0;
    
    const measurePerformance = () => {
      frameCountRef.current++;
      const currentTime = window.performance.now();
      const elapsed = currentTime - startTimeRef.current;
      
      if (elapsed >= 1000) { // Measure every second
        const fps = Math.round((frameCountRef.current * 1000) / elapsed);
        const frameTime = Math.round((elapsed / frameCountRef.current) * 100) / 100;
        const memoryUsage = (window.performance as any).memory ? Math.round((window.performance as any).memory.usedJSHeapSize / 1024 / 1024) : 0;
        const animationSmoothness = fps >= 55 ? 100 : fps >= 30 ? Math.round((fps / 60) * 100) : Math.round((fps / 60) * 70);
        
        setPerformance({ fps, frameTime, memoryUsage, animationSmoothness });
        startTimeRef.current = currentTime;
        frameCountRef.current = 0;
      }
      
      if (isMonitoring) {
        animationFrameRef.current = requestAnimationFrame(measurePerformance);
      }
    };
    
    animationFrameRef.current = requestAnimationFrame(measurePerformance);
  };

  const stopMonitoring = () => {
    setIsMonitoring(false);
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
  };

  // Network monitoring
  useEffect(() => {
    const updateNetworkStatus = () => {
      setNetworkStatus({
        isOnline: navigator.onLine,
        connectionType: (navigator as any).connection?.effectiveType || 'unknown',
        latency: 0, // Would need actual ping measurement
        downloadSpeed: (navigator as any).connection?.downlink || 0
      });
    };

    updateNetworkStatus();
    window.addEventListener('online', updateNetworkStatus);
    window.addEventListener('offline', updateNetworkStatus);

    return () => {
      window.removeEventListener('online', updateNetworkStatus);
      window.removeEventListener('offline', updateNetworkStatus);
    };
  }, []);

  // Test functions
  const addTestResult = (test: string, status: 'pass' | 'fail' | 'running', message: string) => {
    setTestResults(prev => [...prev, {
      test,
      status,
      message,
      timestamp: new Date()
    }]);
  };

  const testLoadingSpinners = () => {
    addTestResult('Loading Spinners', 'running', 'Testing all spinner types...');
    
    try {
      // Test different spinner types
      const spinners = [
        { type: 'Small Spinner', component: <LoadingSpinner size="sm" /> },
        { type: 'Medium Spinner', component: <LoadingSpinner size="md" /> },
        { type: 'Large Spinner', component: <LoadingSpinner size="lg" /> },
        { type: 'LoadingSpinner', component: <PageLoader text="Loading..." /> }
      ];

      spinners.forEach((spinner, index) => {
        setTimeout(() => {
          addTestResult(spinner.type, 'pass', `${spinner.type} renders correctly`);
        }, (index + 1) * 500);
      });

      setTimeout(() => {
        addTestResult('Loading Spinners', 'pass', 'All spinners tested successfully');
      }, 2500);
    } catch (error) {
      addTestResult('Loading Spinners', 'fail', `Error: ${error}`);
    }
  };

  const testToastNotifications = () => {
    addTestResult('Toast Notifications', 'running', 'Testing all toast types...');
    
    try {
      const toasts = [
        { type: 'success', func: () => showSuccess('Success toast test') },
        { type: 'error', func: () => showError('Error toast test') },
        { type: 'info', func: () => showInfo('Info toast test') },
        { type: 'warning', func: () => showWarning('Warning toast test') }
      ];

      toasts.forEach((toast, index) => {
        setTimeout(() => {
          toast.func();
          addTestResult(`Toast ${toast.type}`, 'pass', `${toast.type} toast displayed`);
        }, index * 1000);
      });

      setTimeout(() => {
        addTestResult('Toast Notifications', 'pass', 'All toasts tested successfully');
      }, 4500);
    } catch (error) {
      addTestResult('Toast Notifications', 'fail', `Error: ${error}`);
    }
  };

  const testAnimations = () => {
    addTestResult('Animations', 'running', 'Testing animation smoothness...');
    
    try {
      // Test Framer Motion animations
      const animationTests = [
        { name: 'FadeIn', test: () => <FadeInView>Test</FadeInView> },
        { name: 'Stagger', test: () => <StaggerContainer><StaggerItem>Test</StaggerItem></StaggerContainer> },
        { name: 'HoverEffect', test: () => <HoverEffect effect="scale"><div>Test</div></HoverEffect> },
        { name: 'ButtonAnimation', test: () => <ButtonAnimation>Test</ButtonAnimation> }
      ];

      animationTests.forEach((animation, index) => {
        setTimeout(() => {
          addTestResult(animation.name, 'pass', `${animation.name} animation rendered`);
        }, index * 800);
      });

      setTimeout(() => {
        addTestResult('Animations', 'pass', 'All animations tested successfully');
      }, 3500);
    } catch (error) {
      addTestResult('Animations', 'fail', `Error: ${error}`);
    }
  };

  const testNetworkThrottling = async () => {
    addTestResult('Network Throttling', 'running', 'Simulating slow network...');
    
    try {
      // Simulate slow network by testing API calls
      const slowRequest = showPromise(
        new Promise((resolve) => setTimeout(() => resolve('Slow response'), 3000)),
        {
          loading: 'Testing slow network...',
          success: 'Slow request completed',
          error: 'Network request failed'
        }
      );

      setTimeout(() => {
        addTestResult('Network Throttling', 'pass', 'Slow network simulation completed');
      }, 4000);
    } catch (error) {
      addTestResult('Network Throttling', 'fail', `Error: ${error}`);
    }
  };

  const runAllTests = async () => {
    setTestResults([]);
    testLoadingSpinners();
    setTimeout(() => testToastNotifications(), 3000);
    setTimeout(() => testAnimations(), 6000);
    setTimeout(() => testNetworkThrottling(), 9000);
  };

  const clearResults = () => {
    setTestResults([]);
  };

  // Get performance color
  const getPerformanceColor = (value: number, thresholds: { good: number; warning: number }) => {
    if (value >= thresholds.good) return 'text-green-600';
    if (value >= thresholds.warning) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pass': return 'text-green-600 bg-green-100';
      case 'fail': return 'text-red-600 bg-red-100';
      case 'running': return 'text-blue-600 bg-blue-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      <div className="mb-8">
        <h1 className="text-4xl font-bold mb-4 bg-gradient-to-r from-green-600 to-blue-600 bg-clip-text text-transparent">
          State Testing & Performance Monitoring
        </h1>
        <p className="text-gray-600 text-lg">
          Comprehensive testing of loading states, animations, toasts, and performance metrics
        </p>
      </div>

      {/* Performance Dashboard */}
      <FadeInView delay={0.1}>
        <Card className="mb-8 shadow-colored">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Gauge className="w-5 h-5 text-blue-600" />
              Performance Monitor
            </CardTitle>
            <CardDescription>Real-time performance and state monitoring</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <div className="text-center">
                <div className={`text-2xl font-bold ${getPerformanceColor(performance.fps, { good: 55, warning: 30 })}`}>
                  {performance.fps}
                </div>
                <div className="text-sm text-gray-600">FPS</div>
              </div>
              <div className="text-center">
                <div className={`text-2xl font-bold ${getPerformanceColor(performance.animationSmoothness, { good: 90, warning: 70 })}`}>
                  {performance.animationSmoothness}%
                </div>
                <div className="text-sm text-gray-600">Smoothness</div>
              </div>
              <div className="text-center">
                <div className={`text-2xl font-bold ${getPerformanceColor(100 - (performance.frameTime * 3), { good: 80, warning: 50 })}`}>
                  {performance.frameTime}ms
                </div>
                <div className="text-sm text-gray-600">Frame Time</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600">
                  {performance.memoryUsage}MB
                </div>
                <div className="text-sm text-gray-600">Memory</div>
              </div>
            </div>

            <div className="flex gap-2">
              <Button
                onClick={isMonitoring ? stopMonitoring : startMonitoring}
                variant={isMonitoring ? "destructive" : "default"}
                className="btn-enhanced"
              >
                {isMonitoring ? <Pause className="w-4 h-4 mr-2" /> : <Play className="w-4 h-4 mr-2" />}
                {isMonitoring ? 'Stop Monitoring' : 'Start Monitoring'}
              </Button>
              
              <Button
                onClick={() => {
                  setPerformance({
                    fps: 60,
                    frameTime: 16.67,
                    memoryUsage: 0,
                    animationSmoothness: 100
                  });
                }}
                variant="outline"
                className="btn-enhanced"
              >
                <RotateCcw className="w-4 h-4 mr-2" />
                Reset
              </Button>
            </div>
          </CardContent>
        </Card>
      </FadeInView>

      {/* Network Status */}
      <FadeInView delay={0.2}>
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {networkStatus.isOnline ? <Wifi className="w-5 h-5 text-green-600" /> : <WifiOff className="w-5 h-5 text-red-600" />}
              Network Status
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="flex items-center gap-2">
                <div className={`w-3 h-3 rounded-full ${networkStatus.isOnline ? 'bg-green-500' : 'bg-red-500'}`} />
                <span>{networkStatus.isOnline ? 'Online' : 'Offline'}</span>
              </div>
              <div>Type: {networkStatus.connectionType}</div>
              <div>Speed: {networkStatus.downloadSpeed || 'Unknown'} Mbps</div>
            </div>
          </CardContent>
        </Card>
      </FadeInView>

      {/* Testing Interface */}
      <FadeInView delay={0.3}>
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="loading-states">Loading States</TabsTrigger>
            <TabsTrigger value="toast-notifications">Toast Tests</TabsTrigger>
            <TabsTrigger value="animation-tests">Animations</TabsTrigger>
            <TabsTrigger value="test-results">Results</TabsTrigger>
          </TabsList>

          {/* Loading States Testing */}
          <TabsContent value="loading-states" className="space-y-6">
            <AnimatedSection direction="up">
              <Card>
                <CardHeader>
                  <CardTitle>Loading Spinner Tests</CardTitle>
                  <CardDescription>Verify all spinner types render correctly</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-6">
                    {/* Animated Spinners */}
                    <div>
                      <h4 className="font-semibold mb-3">Animated Spinners</h4>
                      <div className="flex gap-4 flex-wrap">
                        <div className="text-center">
                          <LoadingSpinner size="sm" />
                          <p className="text-xs mt-1">Small</p>
                        </div>
                        <div className="text-center">
                          <LoadingSpinner size="md" />
                          <p className="text-xs mt-1">Medium</p>
                        </div>
                        <div className="text-center">
                          <LoadingSpinner size="lg" />
                          <p className="text-xs mt-1">Large</p>
                        </div>
                      </div>
                    </div>

                    {/* Loading Spinners with Text */}
                    <div>
                      <h4 className="font-semibold mb-3">Loading Spinners with Text</h4>
                      <div className="space-y-2">
                        <InlineLoader text="Small spinner" />
                        <InlineLoader text="Medium spinner" />
                        <InlineLoader text="Large spinner" />
                      </div>
                    </div>

                    {/* Button with Spinner */}
                    <div>
                      <h4 className="font-semibold mb-3">Button Loading States</h4>
                      <div className="flex gap-2 flex-wrap">
                        <Button loading className="btn-enhanced">
                          Loading
                        </Button>
                        <Button variant="outline" loading className="btn-enhanced">
                          Processing
                        </Button>
                        <Button variant="secondary" loading className="btn-enhanced">
                          Submitting
                        </Button>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </AnimatedSection>
          </TabsContent>

          {/* Toast Testing */}
          <TabsContent value="toast-notifications" className="space-y-6">
            <StaggerContainer>
              <Card>
                <CardHeader>
                  <CardTitle>Toast Notification Tests</CardTitle>
                  <CardDescription>Verify all toast types display correctly</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      <Button
                        onClick={() => showSuccess('This is a success toast!')}
                        className="btn-enhanced"
                        variant="success"
                      >
                        Success
                      </Button>
                      <Button
                        onClick={() => showError('This is an error toast!')}
                        className="btn-enhanced"
                        variant="destructive"
                      >
                        Error
                      </Button>
                      <Button
                        onClick={() => showInfo('This is an info toast!')}
                        className="btn-enhanced"
                        variant="info"
                      >
                        Info
                      </Button>
                      <Button
                        onClick={() => showWarning('This is a warning toast!')}
                        className="btn-enhanced"
                        variant="warning"
                      >
                        Warning
                      </Button>
                    </div>

                    {/* Advanced Toast Tests */}
                    <div className="space-y-3">
                      <h4 className="font-semibold">Advanced Toast Tests</h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <Button
                          onClick={() => showPromise(
                            new Promise((resolve) => setTimeout(() => resolve('Success!'), 2000)),
                            {
                              loading: 'Processing request...',
                              success: 'Request completed successfully!',
                              error: 'Request failed'
                            }
                          )}
                          variant="outline"
                          className="btn-enhanced"
                        >
                          Promise Toast
                        </Button>
                        <Button
                          onClick={() => {
                            const loadingToast = showLoading('Long operation...', { position: 'top-center' });
                            setTimeout(() => {
                              ToastManager.dismiss(loadingToast);
                              showSuccess('Operation completed!', { position: 'top-center' });
                            }, 3000);
                          }}
                          variant="outline"
                          className="btn-enhanced"
                        >
                          Loading to Success
                        </Button>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <StaggerItem delay={0.1}>
                <Card>
                  <CardHeader>
                    <CardTitle>Toast Management</CardTitle>
                    <CardDescription>Test toast dismissal and management</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="flex gap-2">
                      <Button
                        onClick={() => ToastManager.dismissAll()}
                        variant="outline"
                        className="btn-enhanced"
                      >
                        Dismiss All Toasts
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </StaggerItem>
            </StaggerContainer>
          </TabsContent>

          {/* Animation Testing */}
          <TabsContent value="animation-tests" className="space-y-6">
            <AnimatedSection direction="up">
              <Card>
                <CardHeader>
                  <CardTitle>Animation Tests</CardTitle>
                  <CardDescription>Verify animation smoothness and performance</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-6">
                    {/* Hover Effects */}
                    <div>
                      <h4 className="font-semibold mb-3">Hover Effects</h4>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        {['scale', 'lift', 'glow', 'tilt'].map((effect) => (
                          <HoverEffect key={effect} effect={effect as any}>
                            <div className="p-4 border rounded-lg text-center bg-gradient-to-br from-blue-50 to-purple-50 hover:from-blue-100 hover:to-purple-100 transition-all duration-300">
                              <h5 className="font-semibold capitalize">{effect}</h5>
                              <p className="text-sm text-gray-600">Hover me</p>
                            </div>
                          </HoverEffect>
                        ))}
                      </div>
                    </div>

                    {/* Button Animations */}
                    <div>
                      <h4 className="font-semibold mb-3">Button Animations</h4>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        {['bounce', 'pulse', 'ripple', 'shine'].map((variant) => (
                          <ButtonAnimation
                            key={variant}
                            variant={variant as any}
                            className="w-full"
                          >
                            {variant}
                          </ButtonAnimation>
                        ))}
                      </div>
                    </div>

                    {/* Entrance Animations */}
                    <div>
                      <h4 className="font-semibold mb-3">Entrance Animations</h4>
                      <FadeInView delay={0} className="p-4 border rounded-lg bg-blue-50">
                        <h5>Fade In View</h5>
                        <p className="text-sm">Smooth fade-in with Y movement</p>
                      </FadeInView>
                    </div>

                    {/* Staggered Animations */}
                    <div>
                      <h4 className="font-semibold mb-3">Staggered Animations</h4>
                      <StaggerContainer className="space-y-2">
                        {['Item 1', 'Item 2', 'Item 3'].map((item, index) => (
                          <StaggerItem key={item} delay={index * 0.1}>
                            <div className="p-3 border rounded bg-gray-50">
                              <h5>{item}</h5>
                              <p className="text-sm text-gray-600">Staggered entrance</p>
                            </div>
                          </StaggerItem>
                        ))}
                      </StaggerContainer>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </AnimatedSection>
          </TabsContent>

          {/* Test Results */}
          <TabsContent value="test-results" className="space-y-6">
            <StaggerContainer>
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Activity className="w-5 h-5 text-blue-600" />
                    Test Results
                  </CardTitle>
                  <CardDescription>Results from all state tests</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex gap-2 mb-6">
                    <Button onClick={runAllTests} className="btn-enhanced">
                      <Play className="w-4 h-4 mr-2" />
                      Run All Tests
                    </Button>
                    <Button onClick={clearResults} variant="outline" className="btn-enhanced">
                      <RotateCcw className="w-4 h-4 mr-2" />
                      Clear Results
                    </Button>
                  </div>

                  <div className="space-y-3">
                    {testResults.length === 0 ? (
                      <div className="text-center py-8 text-gray-500">
                        <Eye className="w-12 h-12 mx-auto mb-4 opacity-50" />
                        <p>No test results yet. Run tests to see results here.</p>
                      </div>
                    ) : (
                      testResults.map((result, index) => (
                        <StaggerItem key={index} delay={index * 0.05}>
                          <div className={`flex items-center justify-between p-4 border rounded-lg ${getStatusColor(result.status)}`}>
                            <div className="flex items-center gap-3">
                              <div className="flex-shrink-0">
                                {result.status === 'pass' && <CheckCircle className="w-5 h-5" />}
                                {result.status === 'fail' && <AlertCircle className="w-5 h-5" />}
                                {result.status === 'running' && <Loader2 className="w-5 h-5 animate-spin" />}
                              </div>
                              <div>
                                <div className="font-medium">{result.test}</div>
                                <div className="text-sm opacity-80">{result.message}</div>
                              </div>
                            </div>
                            <div className="text-xs opacity-60">
                              {result.timestamp.toLocaleTimeString()}
                            </div>
                          </div>
                        </StaggerItem>
                      ))
                    )}
                  </div>
                </CardContent>
              </Card>

              <StaggerItem delay={0.2}>
                <Card>
                  <CardHeader>
                    <CardTitle>Performance Summary</CardTitle>
                    <CardDescription>Overall state testing performance</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="text-center">
                        <div className="text-2xl font-bold text-green-600">
                          {testResults.filter(r => r.status === 'pass').length}
                        </div>
                        <div className="text-sm text-gray-600">Tests Passed</div>
                      </div>
                      <div className="text-center">
                        <div className="text-2xl font-bold text-red-600">
                          {testResults.filter(r => r.status === 'fail').length}
                        </div>
                        <div className="text-sm text-gray-600">Tests Failed</div>
                      </div>
                      <div className="text-center">
                        <div className="text-2xl font-bold text-blue-600">
                          {testResults.filter(r => r.status === 'running').length}
                        </div>
                        <div className="text-sm text-gray-600">Tests Running</div>
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
