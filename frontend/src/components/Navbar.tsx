import { Fragment } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Disclosure, Menu, Transition } from '@headlessui/react';
import { Bars3Icon, XMarkIcon } from '@heroicons/react/24/outline';
import { useAuth } from '../hooks/useAuth';

const navigation = [
  { name: 'Home', href: '/home' },
  { name: 'Summarize', href: '/summarize' },
  { name: 'History', href: '/history' },
];

export default function Navbar() {
  const { isAuthenticated, user, logout } = useAuth();
  const location = useLocation();

  return (
    <Disclosure as="nav" className="bg-white shadow-sm">
      {({ open }) => (
        <>
          <div className="page-container">
            <div className="relative flex h-16 items-center justify-between">
              <div className="flex items-center">
                <Link to="/" className="flex items-center">
                  <span className="text-xl font-bold text-blue-600">AI Summarizer</span>
                </Link>
                <div className="hidden sm:ml-10 sm:flex sm:space-x-8">
                  {navigation.map((item) => (
                    <Link
                      key={item.name}
                      to={item.href}
                      className={`inline-flex items-center px-1 pt-1 text-sm font-medium border-b-2 ${
                        location.pathname === item.href
                          ? 'border-blue-500 text-gray-900'
                          : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
                      }`}
                    >
                      {item.name}
                    </Link>
                  ))}
                </div>
              </div>

              <div className="flex items-center">
                {!isAuthenticated ? (
                  <div className="hidden sm:flex sm:items-center sm:space-x-4">
                    <Link to="/login" className="btn-secondary">
                      Sign in
                    </Link>
                    <Link to="/register" className="btn-primary">
                      Sign up
                    </Link>
                  </div>
                ) : (
                  <Menu as="div" className="relative ml-3">
                    <Menu.Button className="flex rounded-full bg-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2">
                      <span className="sr-only">Open user menu</span>
                      <div className="h-8 w-8 rounded-full bg-blue-100 flex items-center justify-center">
                        <span className="text-blue-600 font-medium">
                          {user?.email?.[0].toUpperCase() || 'U'}
                        </span>
                      </div>
                    </Menu.Button>
                    <Transition
                      as={Fragment}
                      enter="transition ease-out duration-200"
                      enterFrom="transform opacity-0 scale-95"
                      enterTo="transform opacity-100 scale-100"
                      leave="transition ease-in duration-75"
                      leaveFrom="transform opacity-100 scale-100"
                      leaveTo="transform opacity-0 scale-95"
                    >
                      <Menu.Items className="absolute right-0 z-10 mt-2 w-48 origin-top-right rounded-md bg-white py-1 shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none">
                        <Menu.Item>
                          {({ active }) => (
                            <button
                              onClick={logout}
                              className={`block w-full text-left px-4 py-2 text-sm text-red-500 hover:text-red-600 ${
                                active ? 'bg-red-50' : ''
                              }`}
                            >
                              Sign out
                            </button>
                          )}
                        </Menu.Item>
                      </Menu.Items>
                    </Transition>
                  </Menu>
                )}

                {/* Mobile menu button */}
                <div className="flex items-center sm:hidden">
                  <Disclosure.Button className="inline-flex items-center justify-center rounded-md p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-500 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-blue-500">
                    <span className="sr-only">Open main menu</span>
                    {open ? (
                      <XMarkIcon className="block h-6 w-6" aria-hidden="true" />
                    ) : (
                      <Bars3Icon className="block h-6 w-6" aria-hidden="true" />
                    )}
                  </Disclosure.Button>
                </div>
              </div>
            </div>
          </div>

          {/* Mobile menu */}
          <Disclosure.Panel className="sm:hidden">
            <div className="space-y-1 pb-3 pt-2">
              {navigation.map((item) => (
                <Disclosure.Button
                  key={item.name}
                  as={Link}
                  to={item.href}
                  className={`block py-2 pl-3 pr-4 text-base font-medium ${
                    location.pathname === item.href
                      ? 'bg-blue-50 border-l-4 border-blue-500 text-blue-700'
                      : 'text-gray-500 hover:bg-gray-50 hover:text-gray-700'
                  }`}
                >
                  {item.name}
                </Disclosure.Button>
              ))}
              {!isAuthenticated && (
                <div className="mt-4 space-y-2 px-3">
                  <Link
                    to="/login"
                    className="block w-full text-center btn-secondary"
                  >
                    Sign in
                  </Link>
                  <Link
                    to="/register"
                    className="block w-full text-center btn-primary"
                  >
                    Sign up
                  </Link>
                </div>
              )}
            </div>
          </Disclosure.Panel>
        </>
      )}
    </Disclosure>
  );
} 