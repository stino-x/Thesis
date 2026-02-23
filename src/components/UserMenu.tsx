import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { User, Settings, Info, LogOut, Shield, History } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from '@/hooks/useAuth';

interface UserMenuProps {
  onSettingsClick: () => void;
  onAboutClick: () => void;
}

export const UserMenu = ({ onSettingsClick, onAboutClick }: UserMenuProps) => {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await signOut();
    navigate("/login");
  };

  const handleProfileClick = () => {
    navigate("/profile");
  };

  if (!user) return null;

  const getInitials = () => {
    const name = user.user_metadata?.full_name || user.email || "";
    return name.charAt(0).toUpperCase();
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Avatar className="h-9 w-9 cursor-pointer ring-2 ring-primary/20 hover:ring-primary/40 transition-all">
          <AvatarFallback className="bg-gradient-hero text-white font-bold text-base">
            {getInitials()}
          </AvatarFallback>
        </Avatar>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64 glass-strong border-border/50 shadow-xl">
        <DropdownMenuLabel className="pb-3">
          <div className="flex flex-col space-y-1.5">
            <p className="text-base font-bold leading-none">
              {user.user_metadata?.full_name || "User"}
            </p>
            <p className="text-sm leading-none text-muted-foreground font-medium">
              {user.email}
            </p>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator className="bg-border/50" />
        <DropdownMenuItem onClick={handleProfileClick} className="py-2.5 cursor-pointer font-medium">
          <User className="mr-3 h-4 w-4" />
          <span>Profile</span>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => navigate('/detect')} className="py-2.5 cursor-pointer font-medium md:hidden">
          <Shield className="mr-3 h-4 w-4" />
          <span>Detection</span>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => navigate('/audit-logs')} className="py-2.5 cursor-pointer font-medium md:hidden">
          <History className="mr-3 h-4 w-4" />
          <span>Audit Logs</span>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={onSettingsClick} className="py-2.5 cursor-pointer font-medium md:hidden">
          <Settings className="mr-3 h-4 w-4" />
          <span>Settings</span>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={onAboutClick} className="py-2.5 cursor-pointer font-medium md:hidden">
          <Info className="mr-3 h-4 w-4" />
          <span>About</span>
        </DropdownMenuItem>
        <DropdownMenuSeparator className="bg-border/50" />
        <DropdownMenuItem onClick={handleSignOut} className="py-2.5 cursor-pointer font-semibold text-destructive focus:text-destructive focus:bg-destructive/10">
          <LogOut className="mr-3 h-4 w-4" />
          <span>Sign Out</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
