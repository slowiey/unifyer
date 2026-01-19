import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../shared/contexts/AuthContext';

const LandingPage: React.FC = () => {
  const { isAuthenticated } = useAuth();

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50">
      {/* Navigation */}
      <nav className="fixed top-0 w-full bg-white/80 backdrop-blur-lg border-b border-slate-200 z-50">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-indigo-600 rounded-2xl flex items-center justify-center shadow-lg">
              <svg className="w-6 h-6 text-white" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M50 10L10 30L50 50L90 30L50 10Z" fill="currentColor" />
              </svg>
            </div>
            <span className="text-2xl font-bold tracking-tight text-slate-900">Unifyer</span>
          </div>
          <div className="flex items-center gap-4">
            {isAuthenticated ? (
              <Link 
                to="/studio"
                className="px-6 py-2.5 bg-indigo-600 text-white rounded-xl font-semibold hover:bg-indigo-700 transition shadow-lg hover:shadow-xl"
              >
                Go to Studio
              </Link>
            ) : (
              <>
                <Link 
                  to="/studio"
                  className="px-6 py-2.5 text-slate-700 font-semibold hover:text-indigo-600 transition"
                >
                  Log In
                </Link>
                <Link 
                  to="/studio"
                  className="px-6 py-2.5 bg-indigo-600 text-white rounded-xl font-semibold hover:bg-indigo-700 transition shadow-lg hover:shadow-xl"
                >
                  Get Started
                </Link>
              </>
            )}
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="pt-32 pb-20 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="text-center max-w-4xl mx-auto">
            <h1 className="text-6xl md:text-7xl font-extrabold tracking-tight text-slate-900 mb-6">
              Your Academic Life,
              <span className="block bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
                Unified & Simplified
              </span>
            </h1>
            <p className="text-xl md:text-2xl text-slate-600 mb-12 leading-relaxed">
              Master your projects, track exams, and stay organized with AI-powered insights. 
              The all-in-one platform for ambitious students.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link 
                to="/studio"
                className="px-8 py-4 bg-indigo-600 text-white text-lg font-bold rounded-2xl hover:bg-indigo-700 transition shadow-2xl hover:shadow-3xl hover:scale-105 transform"
              >
                Start Free Today
              </Link>
              <a 
                href="#features"
                className="px-8 py-4 bg-white text-slate-700 text-lg font-bold rounded-2xl hover:bg-slate-50 transition border-2 border-slate-200"
              >
                Learn More
              </a>
            </div>
          </div>

          {/* Hero Image/Preview */}
          <div className="mt-20 relative">
            <div className="absolute inset-0 bg-gradient-to-t from-white via-transparent to-transparent z-10" />
            <img 
              src="https://images.unsplash.com/photo-1522202176988-66273c2fd55f?w=1200&q=80" 
              alt="Students collaborating"
              className="w-full h-[500px] object-cover rounded-3xl shadow-2xl"
            />
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-20 px-6 bg-white">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold text-slate-900 mb-4">
              Everything You Need to Excel
            </h2>
            <p className="text-xl text-slate-600">
              Powerful tools designed for the modern student
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* Feature 1 */}
            <div className="p-8 bg-gradient-to-br from-indigo-50 to-white rounded-3xl border border-indigo-100 hover:shadow-xl transition">
              <div className="w-14 h-14 bg-indigo-600 rounded-2xl flex items-center justify-center mb-6">
                <svg className="w-7 h-7 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                </svg>
              </div>
              <h3 className="text-2xl font-bold text-slate-900 mb-3">Project Management</h3>
              <p className="text-slate-600">
                Break down complex projects into manageable tasks. Track progress, set priorities, and never miss a deadline.
              </p>
            </div>

            {/* Feature 2 */}
            <div className="p-8 bg-gradient-to-br from-purple-50 to-white rounded-3xl border border-purple-100 hover:shadow-xl transition">
              <div className="w-14 h-14 bg-purple-600 rounded-2xl flex items-center justify-center mb-6">
                <svg className="w-7 h-7 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                </svg>
              </div>
              <h3 className="text-2xl font-bold text-slate-900 mb-3">Exam Tracking</h3>
              <p className="text-slate-600">
                Organize your exam schedule, create study plans, and track your grades all in one place.
              </p>
            </div>

            {/* Feature 3 */}
            <div className="p-8 bg-gradient-to-br from-pink-50 to-white rounded-3xl border border-pink-100 hover:shadow-xl transition">
              <div className="w-14 h-14 bg-pink-600 rounded-2xl flex items-center justify-center mb-6">
                <svg className="w-7 h-7 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                </svg>
              </div>
              <h3 className="text-2xl font-bold text-slate-900 mb-3">AI Assistant</h3>
              <p className="text-slate-600">
                Get personalized study plans, project breakdowns, and academic guidance powered by Google Gemini AI.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-6 bg-gradient-to-br from-indigo-600 to-purple-600">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-4xl md:text-5xl font-bold text-white mb-6">
            Ready to Transform Your Academic Journey?
          </h2>
          <p className="text-xl text-indigo-100 mb-10">
            Join thousands of students already using Unifyer to excel in their studies
          </p>
          <Link 
            to="/studio"
            className="inline-block px-10 py-5 bg-white text-indigo-600 text-lg font-bold rounded-2xl hover:bg-slate-50 transition shadow-2xl hover:shadow-3xl hover:scale-105 transform"
          >
            Get Started Free
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 px-6 bg-slate-900 text-white">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col md:flex-row justify-between items-center gap-6">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-indigo-600 rounded-xl flex items-center justify-center">
                <svg className="w-5 h-5 text-white" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M50 10L10 30L50 50L90 30L50 10Z" fill="currentColor" />
                </svg>
              </div>
              <span className="text-xl font-bold">Unifyer</span>
            </div>
            <p className="text-slate-400 text-sm">
              © 2026 Unifyer. Built for academic excellence.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;
