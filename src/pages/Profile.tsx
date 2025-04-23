import React from 'react';
import { useAuth } from '../context/AuthContext';
import { PageTitle } from '../components/common/PageTitle'; // Assuming named export and correct path

const Profile: React.FC = () => {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return <div className="container mx-auto px-4 py-8 text-center"><p>Loading profile...</p></div>;
  }

  if (!user) {
    // This should ideally not happen if ProtectedRoute is working correctly,
    // but good to handle as a fallback.
    return <div className="container mx-auto px-4 py-8 text-center"><p>Please log in to view your profile.</p></div>;
  }

  const isAdmin = user.role === 'ADMIN';

  return (
    <div className="container mx-auto px-4 py-8">
      <PageTitle title={isAdmin ? 'Admin Dashboard' : 'Your Profile'} />
      
      {isAdmin ? (
        <div>
          <h2 className="text-xl font-semibold mb-4">Orders Management (Placeholder)</h2>
          <p>Admin-specific content and order management tools will go here.</p>
          {/* Placeholder for Order List Component */}
        </div>
      ) : (
        <div>
          <h2 className="text-xl font-semibold mb-4">Welcome, {user.name || user.email}!</h2>
          <p>User profile details and past orders will go here.</p>
          <p>Email: {user.email}</p>
          {/* Placeholder for User Details / Order History Components */}
        </div>
      )}
    </div>
  );
};

export default Profile; 