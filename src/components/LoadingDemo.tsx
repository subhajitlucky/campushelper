'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  LoadingSpinner, 
  ButtonSpinner, 
  PageLoader, 
  InlineLoader 
} from '@/components/ui/loading-spinner';
import { 
  Skeleton, 
  ItemCardSkeleton, 
  ListSkeleton, 
  FormSkeleton,
  ProfileSkeleton 
} from '@/components/ui/skeleton';
import { ProgressBar, CircularProgress, UploadProgress } from '@/components/ui/progress-bar';
import { useLoading, useSimpleLoading, useApiLoading } from '@/hooks/useLoading';

export default function LoadingDemo() {
  const [progress, setProgress] = useState(0);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [activeTab, setActiveTab] = useState('spinners');

  // Using our loading hooks
  const { loading: apiLoading, progress: apiProgress, startLoading, stopLoading } = useApiLoading();
  const { loading: simpleLoading, startLoading: startSimple, stopLoading: stopSimple } = useSimpleLoading();
  const { loading: complexLoading, withLoading } = useLoading({
    onSuccess: () => console.log('Complex loading completed!'),
    successDelay: 500
  });

  const simulateProgress = () => {
    setProgress(0);
    const interval = setInterval(() => {
      setProgress(prev => {
        if (prev >= 100) {
          clearInterval(interval);
          return 100;
        }
        return prev + 10;
      });
    }, 200);
  };

  const simulateUpload = () => {
    setUploadProgress(0);
    const interval = setInterval(() => {
      setUploadProgress(prev => {
        if (prev >= 100) {
          clearInterval(interval);
          return 100;
        }
        return prev + 5;
      });
    }, 150);
  };

  const simulateApiCall = async () => {
    startLoading();
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 3000));
    stopLoading();
  };

  const simulateComplexLoading = async () => {
    await withLoading(async () => {
      // Simulate complex operation
      await new Promise(resolve => setTimeout(resolve, 2000));
    });
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Loading States Demo</h1>
        <p className="text-gray-600">
          Comprehensive demonstration of all loading states and components
        </p>
      </div>

      {/* Tab Navigation */}
      <div className="flex space-x-1 mb-8 bg-gray-100 p-1 rounded-lg w-fit">
        {[
          { id: 'spinners', label: 'Spinners' },
          { id: 'skeletons', label: 'Skeletons' },
          { id: 'progress', label: 'Progress' },
          { id: 'hooks', label: 'Loading Hooks' }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              activeTab === tab.id 
                ? 'bg-white text-gray-900 shadow-sm' 
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Spinners Tab */}
      {activeTab === 'spinners' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Loading Spinners</CardTitle>
              <CardDescription>Different spinner sizes and styles</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <LoadingSpinner size="sm" text="Small spinner" />
                <LoadingSpinner size="md" text="Medium spinner" />
                <LoadingSpinner size="lg" text="Large spinner" />
                <LoadingSpinner size="xl" text="Extra large spinner" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Spinner Variants</CardTitle>
              <CardDescription>Different animation styles</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <LoadingSpinner variant="spinner" text="Default spinner" />
              <LoadingSpinner variant="dots" text="Dots animation" />
              <LoadingSpinner variant="pulse" text="Pulse animation" />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Button Loading</CardTitle>
              <CardDescription>Loading states in buttons</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Button disabled>
                <ButtonSpinner className="mr-2" />
                Loading...
              </Button>
              <Button variant="outline" disabled>
                <ButtonSpinner className="mr-2" />
                Processing
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Page & Inline Loaders</CardTitle>
              <CardDescription>Full page and inline loading states</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="border rounded-lg p-4">
                <InlineLoader text="Loading content..." />
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Skeletons Tab */}
      {activeTab === 'skeletons' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Item Card Skeleton</CardTitle>
              <CardDescription>Skeleton for item listings</CardDescription>
            </CardHeader>
            <CardContent>
              <ItemCardSkeleton />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>List Skeletons</CardTitle>
              <CardDescription>Multiple skeleton items</CardDescription>
            </CardHeader>
            <CardContent>
              <ListSkeleton count={2} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Profile Skeleton</CardTitle>
              <CardDescription>User profile loading state</CardDescription>
            </CardHeader>
            <CardContent>
              <ProfileSkeleton />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Form Skeleton</CardTitle>
              <CardDescription>Form loading state</CardDescription>
            </CardHeader>
            <CardContent>
              <FormSkeleton />
            </CardContent>
          </Card>
        </div>
      )}

      {/* Progress Tab */}
      {activeTab === 'progress' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Progress Bars</CardTitle>
              <CardDescription>Linear progress indicators</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <ProgressBar value={progress} label="Demo Progress" />
                <Button onClick={simulateProgress} className="mt-2">
                  Simulate Progress
                </Button>
              </div>
              
              <div>
                <ProgressBar value={75} variant="success" label="Completed" />
              </div>
              
              <div>
                <ProgressBar value={45} variant="error" label="Error State" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Circular Progress</CardTitle>
              <CardDescription>Circular progress indicators</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex justify-center">
                <CircularProgress value={progress} size={80} />
              </div>
              
              <div className="flex justify-center">
                <CircularProgress value={100} variant="success" size={60} />
              </div>
            </CardContent>
          </Card>

          <Card className="md:col-span-2">
            <CardHeader>
              <CardTitle>Upload Progress</CardTitle>
              <CardDescription>File upload with progress tracking</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <UploadProgress
                fileName="document.pdf"
                progress={uploadProgress}
                status={uploadProgress === 100 ? 'success' : 'uploading'}
                speed="2.3 MB/s"
                timeRemaining="15s"
              />
              <Button onClick={simulateUpload} disabled={uploadProgress > 0 && uploadProgress < 100}>
                {uploadProgress === 0 ? 'Start Upload' : 
                 uploadProgress === 100 ? 'Upload Complete' : 
                 `Uploading... ${uploadProgress}%`}
              </Button>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Loading Hooks Tab */}
      {activeTab === 'hooks' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Simple Loading Hook</CardTitle>
              <CardDescription>Basic loading state management</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-2">
                <div className={`w-3 h-3 rounded-full ${simpleLoading ? 'bg-blue-500 animate-pulse' : 'bg-gray-300'}`} />
                <span>{simpleLoading ? 'Loading...' : 'Idle'}</span>
              </div>
              <div className="space-x-2">
                <Button onClick={startSimple} disabled={simpleLoading}>
                  Start Loading
                </Button>
                <Button onClick={stopSimple} variant="outline" disabled={!simpleLoading}>
                  Stop Loading
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>API Loading Hook</CardTitle>
              <CardDescription>API call with progress tracking</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {apiLoading && (
                <div className="space-y-2">
                  <ProgressBar value={apiProgress} label="API Call Progress" showLabel={false} />
                  <p className="text-sm text-gray-600">{apiProgress}% complete</p>
                </div>
              )}
              <Button onClick={simulateApiCall} disabled={apiLoading}>
                {apiLoading ? 'Calling API...' : 'Simulate API Call'}
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Complex Loading Hook</CardTitle>
              <CardDescription>Loading with success callback</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-2">
                <div className={`w-3 h-3 rounded-full ${complexLoading ? 'bg-green-500 animate-pulse' : 'bg-gray-300'}`} />
                <span>{complexLoading ? 'Processing...' : 'Ready'}</span>
              </div>
              <Button onClick={simulateComplexLoading} disabled={complexLoading}>
                {complexLoading ? 'Processing...' : 'Start Complex Task'}
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Hook Features</CardTitle>
              <CardDescription>What's included in our loading hooks</CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 text-sm">
                <li>✅ Automatic loading state management</li>
                <li>✅ Progress tracking support</li>
                <li>✅ Success and error callbacks</li>
                <li>✅ TypeScript support</li>
                <li>✅ Reusable across components</li>
                <li>✅ Consistent API design</li>
              </ul>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
