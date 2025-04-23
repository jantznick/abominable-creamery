import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

const ProtectedRoute: React.FC = () => {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    // Optional: Render a loading spinner or skeleton screen
    return <div className="container mx-auto px-4 py-8 text-center"><p>Loading user...</p></div>;
  }

  if (!user) {
    // User is not logged in, redirect to home page.
    // Alternatively, could redirect to a dedicated login page or trigger login modal.
    console.log('ProtectedRoute: User not found, redirecting to /');
    return <Navigate to="/" replace />;
  }

  // User is authenticated, render the child route element
  return <Outlet />;
};

export default ProtectedRoute; 