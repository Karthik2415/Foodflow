'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { motion } from 'framer-motion';
import { useAuth } from '@/lib/auth/auth-context';
import { Button, Input, Select } from '@/components/ui';
import { Mail, Lock, ArrowRight, Factory, User, Database, Wifi } from 'lucide-react';
import { APP_NAME } from '@/lib/constants';
import type { UserRole } from '@/lib/types';

const DEMO_ACCOUNTS = [
  { email: 'owner@foodflow.in', role: 'Owner', name: 'Rajesh Kumar' },
  { email: 'admin@foodflow.in', role: 'Admin', name: 'Priya Sharma' },
  { email: 'salesman@foodflow.in', role: 'Salesman', name: 'Salesman A' },
  { email: 'production@foodflow.in', role: 'Production', name: 'Murugan S' },
  { email: 'accountant@foodflow.in', role: 'Accountant', name: 'Lakshmi R' },
];

export default function LoginPage() {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [role, setRole] = useState<UserRole>('owner');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const { login, register, isLiveFirebase } = useAuth();
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');
    try {
      if (mode === 'login') {
        await login(email, password || 'demo');
      } else {
        await register(email, password, displayName || 'Factory Owner', role);
      }
      router.push('/dashboard');
    } catch (err: any) {
      setError(err.message || 'Authentication failed');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDemoLogin = async (loginEmail: string) => {
    setIsLoading(true);
    setError('');
    try {
      await login(loginEmail, 'demo');
      router.push('/dashboard');
    } catch (err: any) {
      setError(err.message || 'Login failed');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex">
      {/* Left side — Branding */}
      <div className="hidden lg:flex lg:w-1/2 bg-primary-950 relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--color-primary-800)_0%,_transparent_60%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_left,_var(--color-info-900)_0%,_transparent_50%)]" />
        <div className="relative z-10 flex flex-col justify-between p-12">
          <div className="flex items-center gap-3">
            <Image src="/logo.png" alt="FoodFlow" width={220} height={70} className="object-contain" priority />
          </div>

          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
          >
            <h1 className="text-4xl font-bold text-white leading-tight">
              Order-to-Audit
              <br />
              <span className="text-primary-300">Management Platform</span>
            </h1>
            <p className="mt-4 text-lg text-primary-200/80 max-w-md">
              Enterprise-grade manufacturing management for South Indian packaged food companies.
              Track orders, production, inventory, and finances — all in one place.
            </p>
          </motion.div>

          <div className="flex items-center gap-6 text-sm text-primary-300/60">
            <span>Inventory</span>
            <span className="h-1 w-1 rounded-full bg-primary-400/40" />
            <span>Production</span>
            <span className="h-1 w-1 rounded-full bg-primary-400/40" />
            <span>GST Invoicing</span>
            <span className="h-1 w-1 rounded-full bg-primary-400/40" />
            <span>Analytics</span>
          </div>
        </div>
      </div>

      {/* Right side — Login Form */}
      <div className="flex w-full lg:w-1/2 items-center justify-center p-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="w-full max-w-md"
        >
          {/* Mobile logo */}
          <div className="flex items-center gap-3 mb-8 lg:hidden">
            <Image src="/logo.png" alt="FoodFlow" width={180} height={56} className="object-contain" />
          </div>

          {/* Connection Status Pill — only shown in Demo Mode */}
          {!isLiveFirebase && (
            <div className="mb-4">
              <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-800 border border-amber-200">
                <Database className="h-3.5 w-3.5" />
                Demo Mode — Not connected to a live Firebase project
              </span>
            </div>
          )}

          <h2 className="text-3xl font-extrabold tracking-tight text-surface-900">
            {mode === 'login' ? 'Welcome back' : 'Create account'}
          </h2>
          <p className="mt-1.5 text-base text-surface-500">
            {mode === 'login'
              ? 'Sign in to your account to continue'
              : 'Register a new user in Firebase Authentication'}
          </p>

          {error && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-4 rounded-xl bg-rose-50 border border-rose-200 px-4 py-3 text-sm text-rose-700 font-medium"
            >
              {error}
            </motion.div>
          )}

          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            {mode === 'register' && (
              <>
                <Input
                  label="Full Name"
                  type="text"
                  required
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="Rajesh Kumar"
                  icon={User}
                />
                {!isLiveFirebase ? (
                  <Select
                    label="Role (Demo Mode)"
                    value={role}
                    onChange={(e) => setRole(e.target.value as UserRole)}
                    options={[
                      { value: 'owner', label: 'Owner / CEO' },
                      { value: 'admin', label: 'Administrator' },
                      { value: 'salesman', label: 'Salesman' },
                      { value: 'production_supervisor', label: 'Production Supervisor' },
                      { value: 'accountant', label: 'Accountant / Auditor' },
                    ]}
                  />
                ) : (
                  <p className="text-xs text-surface-500 bg-surface-100 rounded-xl px-3 py-2 border border-surface-200">
                    New accounts start with <strong>Salesman</strong> access. An Owner or Admin can assign elevated roles.
                  </p>
                )}
              </>
            )}

            <Input
              label="Email address"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="owner@foodflow.in"
              icon={Mail}
            />
            <Input
              label="Password"
              type="password"
              required={isLiveFirebase}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={isLiveFirebase ? 'Enter password (min 6 chars)' : 'Enter any password'}
              icon={Lock}
            />
            <Button
              type="submit"
              className="w-full"
              loading={isLoading}
              icon={ArrowRight}
              iconPosition="right"
            >
              {mode === 'login' ? 'Sign in' : 'Create account'}
            </Button>
          </form>

          <div className="mt-4 text-center">
            <button
              type="button"
              onClick={() => {
                setMode(mode === 'login' ? 'register' : 'login');
                setError('');
              }}
              className="text-sm font-semibold text-primary-600 hover:text-primary-700 cursor-pointer"
            >
              {mode === 'login'
                ? 'Need a new Firebase account? Create one'
                : 'Already have an account? Sign in'}
            </button>
          </div>

          {/* Demo Quick Login (shown in Demo Mode) */}
          {!isLiveFirebase && (
            <div className="mt-8">
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-surface-200" />
                </div>
                <div className="relative flex justify-center text-xs">
                  <span className="bg-surface-50 px-3 text-surface-400">Quick demo login</span>
                </div>
              </div>

              <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-2">
                {DEMO_ACCOUNTS.map((account) => (
                  <motion.button
                    key={account.email}
                    type="button"
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => handleDemoLogin(account.email)}
                    className="flex items-center gap-3 rounded-xl border border-surface-200 bg-white px-3.5 py-2.5 text-left transition-colors hover:border-primary-300 hover:bg-primary-50/50 cursor-pointer"
                  >
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary-100 text-primary-700">
                      <span className="text-[10px] font-semibold">
                        {account.name.split(' ').map((n) => n[0]).join('')}
                      </span>
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-surface-900 truncate">{account.name}</p>
                      <p className="text-xs text-surface-400">{account.role}</p>
                    </div>
                  </motion.button>
                ))}
              </div>
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
}
