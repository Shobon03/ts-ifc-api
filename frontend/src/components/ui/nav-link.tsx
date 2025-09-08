import { Link, useLocation } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';

type NavLinkProps = {
  to: string;
  name: string;
};

function NavLink({ to, name }: NavLinkProps) {
  const location = useLocation();
  const [isActive, setIsActive] = useState(false);

  useEffect(() => {
    setIsActive(location.pathname === to);
  }, [location, to]);

  return (
    <Link
      to={to}
      className={cn(
        'text-gray-700 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 transition-colors',
        isActive && 'font-semibold',
      )}
    >
      {name}
    </Link>
  );
}

export { NavLink };
