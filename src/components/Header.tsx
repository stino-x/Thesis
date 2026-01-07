import { Settings, Github, Info, Moon, Sun } from "lucide-react";
import { Button } from "./ui/button";
import { useTheme } from "next-themes";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { useAuth } from '@/hooks/useAuth';
import { UserMenu } from "./UserMenu";

interface HeaderProps {
  onSettingsClick: () => void;
  onAboutClick: () => void;
}

export const Header = ({ onSettingsClick, onAboutClick }: HeaderProps) => {
  const { theme, setTheme } = useTheme();
  const { user } = useAuth();

  return (
    <motion.header 
      className="sticky top-0 z-50 w-full glass-strong border-b border-border/50"
      initial={{ y: -100 }}
      animate={{ y: 0 }}
      transition={{ duration: 0.5, ease: "easeOut" }}
    >
      <div className="container mx-auto flex h-16 items-center justify-between px-4">
        <motion.div 
          className="flex items-center gap-2"
          whileHover={{ scale: 1.02 }}
          transition={{ duration: 0.2 }}
        >
          <Link to="/" className="flex items-center gap-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg gradient-hero">
              <span className="text-xl font-bold">🔍</span>
            </div>
            <span className="text-xl font-bold hidden sm:inline">DeepFake Detector</span>
          </Link>
        </motion.div>

        <nav className="hidden md:flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={onAboutClick}>
            About
          </Button>
          <Button variant="ghost" size="sm" asChild>
            <a
              href="https://github.com"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2"
            >
              <Github className="h-4 w-4" />
              GitHub
            </a>
          </Button>
        </nav>

        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            className="relative"
          >
            <Sun className="h-5 w-5 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
            <Moon className="absolute h-5 w-5 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
            <span className="sr-only">Toggle theme</span>
          </Button>
          
          {user ? (
            <>
              <Button variant="ghost" size="icon" onClick={onSettingsClick}>
                <Settings className="h-5 w-5" />
              </Button>
              <UserMenu 
                onSettingsClick={onSettingsClick}
                onAboutClick={onAboutClick}
              />
            </>
          ) : (
            <>
              <Button variant="ghost" size="icon" onClick={onAboutClick} className="md:hidden">
                <Info className="h-5 w-5" />
              </Button>
              <Button asChild>
                <Link to="/login">Sign In</Link>
              </Button>
            </>
          )}
        </div>
      </div>
    </motion.header>
  );
};
