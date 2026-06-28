import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { LanguageProvider } from "./contexts/LanguageContext";
import { ThemeProvider } from "./contexts/ThemeContext";
import Admin from "./pages/Admin";
import ReferralTracker from "./components/ReferralTracker";
import PromoPopup from "./components/PromoPopup";
import Balance from "./pages/Balance";
import Home from "./pages/Home";
import Profile from "./pages/Profile";
import Leaderboard from "./pages/Leaderboard";
import Orders from "./pages/Orders";
import ProductDetail from "./pages/ProductDetail";
import Spin from "./pages/Spin";
import Help from "./pages/Help";
import RankBoost from "./pages/RankBoost";
import GameAccounts from "./pages/GameAccounts";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/product/:slug" component={ProductDetail} />
      <Route path="/balance" component={Balance} />
      <Route path="/orders" component={Orders} />
      <Route path="/profile" component={Profile} />
      <Route path="/spin" component={Spin} />
      <Route path="/help" component={Help} />
      <Route path="/rank-boost" component={RankBoost} />
      <Route path="/game-accounts" component={GameAccounts} />
      <Route path="/leaderboard" component={Leaderboard} />
      <Route path="/admin" component={Admin} />
      <Route path="/404" component={NotFound} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="dark">
        <LanguageProvider>
          <TooltipProvider>
            <Toaster position="top-center" />
            <Router />
            <ReferralTracker />
            <PromoPopup />
          </TooltipProvider>
        </LanguageProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
