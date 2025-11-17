import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { AnimatedBackground } from '@/components/AnimatedBackground';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft, Mail, Loader2, CheckCircle } from 'lucide-react';
import { motion } from 'framer-motion';
import { toast } from 'sonner';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isEmailSent, setIsEmailSent] = useState(false);
  const { resetPassword } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email) {
      toast.error('Please enter your email address');
      return;
    }

    setIsLoading(true);

    try {
      const { error } = await resetPassword(email);
      
      if (error) {
        toast.error(error.message);
      } else {
        setIsEmailSent(true);
      }
    } catch {
      toast.error('An unexpected error occurred. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  if (isEmailSent) {
    return (
      <div className="min-h-screen flex items-center justify-center relative">
        <AnimatedBackground />
        
        <motion.div
          className="w-full max-w-md relative z-10"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <Card className="glass-strong">
            <CardHeader className="text-center">
              <div className="flex justify-center mb-4">
                <CheckCircle className="h-16 w-16 text-green-500" />
              </div>
              <CardTitle className="text-2xl text-white">Check Your Email</CardTitle>
              <CardDescription className="text-gray-300">
                We've sent a password reset link to your email address
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="text-center space-y-4">
                <p className="text-sm text-gray-300">
                  We've sent a password reset link to <strong>{email}</strong>
                </p>
                <p className="text-sm text-gray-400">
                  Click the link in the email to reset your password. The link will expire in 24 hours.
                </p>
                <p className="text-sm text-gray-400">
                  Didn't receive the email? Check your spam folder or try again.
                </p>
              </div>
              
              <div className="space-y-4">
                <Button 
                  onClick={() => setIsEmailSent(false)}
                  variant="outline" 
                  className="w-full border-white/20 text-white hover:bg-white/10"
                >
                  Try Different Email
                </Button>
                
                <Link to="/login">
                  <Button className="w-full bg-purple-600 hover:bg-purple-700">
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Back to Login
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center relative">
      <AnimatedBackground />
      
      <motion.div
        className="w-full max-w-md relative z-10"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <Card className="glass-strong">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl text-white">Reset Your Password</CardTitle>
            <CardDescription className="text-gray-300">
              Enter your email address and we'll send you a reset link
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email" className="text-white flex items-center gap-2">
                  <Mail className="h-4 w-4" />
                  Email Address
                </Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="Enter your email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="bg-black/20 border-white/20 text-white placeholder:text-gray-400"
                  required
                />
              </div>



              <Button 
                type="submit" 
                className="w-full bg-purple-600 hover:bg-purple-700"
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Sending Reset Link...
                  </>
                ) : (
                  'Send Reset Link'
                )}
              </Button>
            </form>

            <div className="text-center">
              <Link 
                to="/login"
                className="text-sm text-purple-400 hover:text-purple-300 flex items-center justify-center gap-2"
              >
                <ArrowLeft className="h-4 w-4" />
                Back to Login
              </Link>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}