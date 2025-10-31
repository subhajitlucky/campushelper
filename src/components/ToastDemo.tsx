'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { 
  ToastManager, 
  showSuccess, 
  showError, 
  showInfo, 
  showWarning, 
  showLoading, 
  showPromise,
  TOAST_MESSAGES,
  POSITIONS 
} from '@/lib/toast-config';
import { toast } from 'react-hot-toast';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';

export default function ToastDemo() {
  const [customMessage, setCustomMessage] = useState('');
  const [position, setPosition] = useState<typeof POSITIONS[keyof typeof POSITIONS]>(POSITIONS.TOP_RIGHT);
  const [duration, setDuration] = useState(3000);
  const [activeTab, setActiveTab] = useState('basic');

  // Basic toast examples
  const showBasicToast = (type: 'success' | 'error' | 'info' | 'warning') => {
    const messages = {
      success: 'This is a success message!',
      error: 'This is an error message!',
      info: 'This is an information message!',
      warning: 'This is a warning message!'
    };

    switch (type) {
      case 'success':
        showSuccess(messages.success, { position, duration });
        break;
      case 'error':
        showError(messages.error, { position, duration });
        break;
      case 'info':
        showInfo(messages.info, { position, duration });
        break;
      case 'warning':
        showWarning(messages.warning, { position, duration });
        break;
    }
  };

  // Predefined message examples
  const showPredefinedToast = (category: 'SUCCESS' | 'ERROR' | 'INFO' | 'WARNING', key: string) => {
    const message = TOAST_MESSAGES[category][key as keyof typeof TOAST_MESSAGES[typeof category]];
    if (message) {
      switch (category) {
        case 'SUCCESS':
          showSuccess(message, { position, duration });
          break;
        case 'ERROR':
          showError(message, { position, duration });
          break;
        case 'INFO':
          showInfo(message, { position, duration });
          break;
        case 'WARNING':
          showWarning(message, { position, duration });
          break;
      }
    }
  };

  // Promise toast example
  const showPromiseToast = () => {
    const promise = new Promise((resolve) => {
      setTimeout(() => {
        resolve({ message: 'Data saved successfully!' });
      }, 2000);
    });

    showPromise(promise, {
      loading: 'Saving your data...',
      success: (data) => `✅ ${(data as { message: string }).message}`,
      error: 'Failed to save data. Please try again.',
    }, { position, duration });
  };

  // API toast examples
  const showApiToast = (action: string) => {
    ToastManager.promise(
      new Promise((resolve, reject) => {
        setTimeout(() => {
          if (Math.random() > 0.3) {
            resolve({ success: true, data: 'Operation completed' });
          } else {
            reject(new Error('Operation failed'));
          }
        }, 1500);
      }),
      {
        loading: `Processing ${action}...`,
        success: `✅ ${action} completed successfully!`,
        error: `❌ ${action} failed. Please try again.`,
      },
      { position }
    );
  };

  // Loading toast example
  const showLoadingToast = () => {
    const loadingToast = showLoading('Processing your request...', { position });
    
    // Auto-dismiss after 3 seconds
    setTimeout(() => {
      ToastManager.dismiss(loadingToast);
      showSuccess('Request completed!', { position });
    }, 3000);
  };

  // Custom toast example
  const showCustomToast = () => {
    if (!customMessage.trim()) {
      showError('Please enter a message first');
      return;
    }

    ToastManager.custom(customMessage, {
      type: 'info',
      position,
      duration,
      icon: '🚀',
    });
  };

  // Dismiss all toasts
  const dismissAllToasts = () => {
    ToastManager.dismissAll();
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Toast Notifications Demo</h1>
        <p className="text-gray-600">
          Comprehensive demonstration of all toast notification types and configurations
        </p>
        <div className="mt-4 flex items-center gap-4">
          <Badge variant="outline">
            Toast Notifications System
          </Badge>
          <Button variant="outline" onClick={dismissAllToasts}>
            Dismiss All
          </Button>
        </div>
      </div>

      {/* Configuration Panel */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle>Toast Configuration</CardTitle>
          <CardDescription>Customize toast appearance and behavior</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2">Position</label>
              <select 
                value={position} 
                onChange={(e) => setPosition(e.target.value as typeof POSITIONS[keyof typeof POSITIONS])}
                className="w-full px-3 py-2 border rounded-md"
              >
                <option value={POSITIONS.TOP_RIGHT}>Top Right</option>
                <option value={POSITIONS.TOP_LEFT}>Top Left</option>
                <option value={POSITIONS.TOP_CENTER}>Top Center</option>
                <option value={POSITIONS.BOTTOM_RIGHT}>Bottom Right</option>
                <option value={POSITIONS.BOTTOM_LEFT}>Bottom Left</option>
                <option value={POSITIONS.BOTTOM_CENTER}>Bottom Center</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Duration (ms)</label>
              <Input
                type="number"
                value={duration}
                onChange={(e) => setDuration(Number(e.target.value))}
                min="1000"
                max="10000"
                step="500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Custom Message</label>
              <Input
                value={customMessage}
                onChange={(e) => setCustomMessage(e.target.value)}
                placeholder="Enter custom message..."
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Demo Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="basic">Basic Types</TabsTrigger>
          <TabsTrigger value="predefined">Predefined</TabsTrigger>
          <TabsTrigger value="api">API Examples</TabsTrigger>
          <TabsTrigger value="promise">Promise Toasts</TabsTrigger>
          <TabsTrigger value="advanced">Advanced</TabsTrigger>
        </TabsList>

        {/* Basic Toast Types */}
        <TabsContent value="basic" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Success Toast</CardTitle>
                <CardDescription>Shows positive feedback to users</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Button onClick={() => showBasicToast('success')} className="w-full">
                    Show Success Toast
                  </Button>
                  <p className="text-sm text-gray-600">✅ Success messages appear in green</p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Error Toast</CardTitle>
                <CardDescription>Shows error messages to users</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Button onClick={() => showBasicToast('error')} variant="destructive" className="w-full">
                    Show Error Toast
                  </Button>
                  <p className="text-sm text-gray-600">❌ Error messages appear in red</p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Info Toast</CardTitle>
                <CardDescription>Shows informational messages</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Button onClick={() => showBasicToast('info')} className="w-full" variant="outline">
                    Show Info Toast
                  </Button>
                  <p className="text-sm text-gray-600">ℹ️ Info messages appear in blue</p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Warning Toast</CardTitle>
                <CardDescription>Shows warning messages</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Button onClick={() => showBasicToast('warning')} className="w-full" variant="outline">
                    Show Warning Toast
                  </Button>
                  <p className="text-sm text-gray-600">⚠️ Warning messages appear in yellow</p>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Predefined Messages */}
        <TabsContent value="predefined" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Success Messages</CardTitle>
                <CardDescription>Common success message templates</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {Object.entries(TOAST_MESSAGES.SUCCESS).map(([key, message]) => (
                  <Button
                    key={key}
                    onClick={() => showPredefinedToast('SUCCESS', key)}
                    variant="outline"
                    size="sm"
                    className="w-full justify-start"
                  >
                    {message}
                  </Button>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Error Messages</CardTitle>
                <CardDescription>Common error message templates</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {Object.entries(TOAST_MESSAGES.ERROR).map(([key, message]) => (
                  <Button
                    key={key}
                    onClick={() => showPredefinedToast('ERROR', key)}
                    variant="outline"
                    size="sm"
                    className="w-full justify-start"
                  >
                    {message}
                  </Button>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Info Messages</CardTitle>
                <CardDescription>Common informational message templates</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {Object.entries(TOAST_MESSAGES.INFO).map(([key, message]) => (
                  <Button
                    key={key}
                    onClick={() => showPredefinedToast('INFO', key)}
                    variant="outline"
                    size="sm"
                    className="w-full justify-start"
                  >
                    {message}
                  </Button>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Warning Messages</CardTitle>
                <CardDescription>Common warning message templates</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {Object.entries(TOAST_MESSAGES.WARNING).map(([key, message]) => (
                  <Button
                    key={key}
                    onClick={() => showPredefinedToast('WARNING', key)}
                    variant="outline"
                    size="sm"
                    className="w-full justify-start"
                  >
                    {message}
                  </Button>
                ))}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* API Examples */}
        <TabsContent value="api" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>API Loading States</CardTitle>
                <CardDescription>Toast notifications for API operations</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Button onClick={() => showApiToast('Save Profile')} className="w-full">
                    Save Profile
                  </Button>
                  <Button onClick={() => showApiToast('Create Item')} className="w-full" variant="outline">
                    Create Item
                  </Button>
                  <Button onClick={() => showApiToast('Update Settings')} className="w-full" variant="outline">
                    Update Settings
                  </Button>
                  <Button onClick={() => showApiToast('Send Message')} className="w-full" variant="outline">
                    Send Message
                  </Button>
                </div>
                <p className="text-sm text-gray-600">
                  These show loading → success/error flow automatically
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Loading Indicator</CardTitle>
                <CardDescription>Persistent loading toast</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Button onClick={showLoadingToast} className="w-full" variant="outline">
                  Show Loading Toast
                </Button>
                <p className="text-sm text-gray-600">
                  Loading toast that auto-dismisses and shows success
                </p>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Promise Toasts */}
        <TabsContent value="promise" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Promise-based Toast</CardTitle>
                <CardDescription>Automatic success/error handling</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Button onClick={showPromiseToast} className="w-full">
                  Execute Promise
                </Button>
                <p className="text-sm text-gray-600">
                  This will show loading, then automatically resolve to success or error
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Promise with Custom Messages</CardTitle>
                <CardDescription>Dynamic success messages based on data</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Button onClick={() => {
                  showPromise(
                    new Promise((resolve) => setTimeout(() => resolve({ id: 123, name: 'Item' }), 1500)),
                    {
                      loading: 'Creating item...',
                      success: (data) => `✅ Item "${(data as { name: string }).name}" created with ID ${(data as { id: number }).id}!`,
                      error: 'Failed to create item',
                    },
                    { position }
                  );
                }} className="w-full" variant="outline">
                  Create Item with Data
                </Button>
                <p className="text-sm text-gray-600">
                  Success message includes dynamic data from the promise
                </p>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Advanced Features */}
        <TabsContent value="advanced" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Custom Toast</CardTitle>
                <CardDescription>Custom message with options</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Button onClick={showCustomToast} className="w-full">
                  Show Custom Toast
                </Button>
                <p className="text-sm text-gray-600">
                  Uses the custom message from the input field above
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Multiple Toasts</CardTitle>
                <CardDescription>Show multiple toasts at once</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Button onClick={() => {
                  showSuccess('First success message', { position });
                  showInfo('Info message', { position });
                  showWarning('Warning message', { position });
                  showError('Error message', { position });
                }} className="w-full" variant="outline">
                  Show Multiple Toasts
                </Button>
                <p className="text-sm text-gray-600">
                  Test how multiple toasts stack and position
                </p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Features Summary</CardTitle>
              <CardDescription>What our toast system provides</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 text-sm">
                <div className="space-y-2">
                  <h4 className="font-semibold text-green-600">✅ Success Toasts</h4>
                  <ul className="space-y-1 text-gray-600">
                    <li>• Auto-dismiss after 3s</li>
                    <li>• Green styling</li>
                    <li>• Checkmark icon</li>
                    <li>• Success sounds</li>
                  </ul>
                </div>
                <div className="space-y-2">
                  <h4 className="font-semibold text-red-600">❌ Error Toasts</h4>
                  <ul className="space-y-1 text-gray-600">
                    <li>• Auto-dismiss after 5s</li>
                    <li>• Red styling</li>
                    <li>• Error icon</li>
                    <li>• Critical messages</li>
                  </ul>
                </div>
                <div className="space-y-2">
                  <h4 className="font-semibold text-blue-600">ℹ️ Info Toasts</h4>
                  <ul className="space-y-1 text-gray-600">
                    <li>• Auto-dismiss after 4s</li>
                    <li>• Blue styling</li>
                    <li>• Info icon</li>
                    <li>• General information</li>
                  </ul>
                </div>
                <div className="space-y-2">
                  <h4 className="font-semibold text-yellow-600">⚠️ Warning Toasts</h4>
                  <ul className="space-y-1 text-gray-600">
                    <li>• Auto-dismiss after 4.5s</li>
                    <li>• Yellow styling</li>
                    <li>• Warning icon</li>
                    <li>• Important notices</li>
                  </ul>
                </div>
                <div className="space-y-2">
                  <h4 className="font-semibold text-purple-600">⏳ Loading Toasts</h4>
                  <ul className="space-y-1 text-gray-600">
                    <li>• Persistent until dismissed</li>
                    <li>• Purple styling</li>
                    <li>• Spinner icon</li>
                    <li>• Progress indication</li>
                  </ul>
                </div>
                <div className="space-y-2">
                  <h4 className="font-semibold text-indigo-600">🎯 Advanced Features</h4>
                  <ul className="space-y-1 text-gray-600">
                    <li>• Promise-based toasts</li>
                    <li>• Custom positioning</li>
                    <li>• Adjustable duration</li>
                    <li>• Programmatic control</li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
