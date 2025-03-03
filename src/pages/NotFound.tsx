
import { useLocation } from "react-router-dom";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error(
      "404 Error: User attempted to access non-existent route:",
      location.pathname
    );
  }, [location.pathname]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-b from-gray-50 to-gray-100">
      <div className="text-center max-w-md px-4 animate-fade-in">
        <h1 className="text-6xl font-bold text-gray-900 mb-2">404</h1>
        <div className="w-16 h-1 bg-primary mx-auto mb-6 rounded-full"></div>
        <p className="text-xl text-gray-700 mb-8">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <Button asChild className="px-8 py-6 text-base shadow-lg">
          <a href="/">Return to Home</a>
        </Button>
      </div>
    </div>
  );
};

export default NotFound;
