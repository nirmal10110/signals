import Alerts from './pages/Alerts';
import ColdEmailGenerator from './pages/ColdEmailGenerator';
import Companies from './pages/Companies';
import Dashboard from './pages/Dashboard';
import DigestHistory from './pages/DigestHistory';
import DigestRecovery from './pages/DigestRecovery';
import Digests from './pages/Digests';
import EmailGuidelines from './pages/EmailGuidelines';
import Home from './pages/Home';
import Monitoring from './pages/Monitoring';
import ResearchLibrary from './pages/ResearchLibrary';
import Settings from './pages/Settings';
import Templates from './pages/Templates';
import TopTargets from './pages/TopTargets';
import __Layout from './Layout.jsx';


export const PAGES = {
    "Alerts": Alerts,
    "ColdEmailGenerator": ColdEmailGenerator,
    "Companies": Companies,
    "Dashboard": Dashboard,
    "DigestHistory": DigestHistory,
    "DigestRecovery": DigestRecovery,
    "Digests": Digests,
    "EmailGuidelines": EmailGuidelines,
    "Home": Home,
    "Monitoring": Monitoring,
    "ResearchLibrary": ResearchLibrary,
    "Settings": Settings,
    "Templates": Templates,
    "TopTargets": TopTargets,
}

export const pagesConfig = {
    mainPage: "Dashboard",
    Pages: PAGES,
    Layout: __Layout,
};