import Dashboard from './pages/Dashboard';
import Companies from './pages/Companies';
import Alerts from './pages/Alerts';
import Templates from './pages/Templates';
import Monitoring from './pages/Monitoring';
import Digests from './pages/Digests';
import TopTargets from './pages/TopTargets';
import ColdEmailGenerator from './pages/ColdEmailGenerator';
import ResearchLibrary from './pages/ResearchLibrary';
import EmailGuidelines from './pages/EmailGuidelines';
import Settings from './pages/Settings';
import DigestRecovery from './pages/DigestRecovery';
import DigestHistory from './pages/DigestHistory';
import __Layout from './Layout.jsx';


export const PAGES = {
    "Dashboard": Dashboard,
    "Companies": Companies,
    "Alerts": Alerts,
    "Templates": Templates,
    "Monitoring": Monitoring,
    "Digests": Digests,
    "TopTargets": TopTargets,
    "ColdEmailGenerator": ColdEmailGenerator,
    "ResearchLibrary": ResearchLibrary,
    "EmailGuidelines": EmailGuidelines,
    "Settings": Settings,
    "DigestRecovery": DigestRecovery,
    "DigestHistory": DigestHistory,
}

export const pagesConfig = {
    mainPage: "Dashboard",
    Pages: PAGES,
    Layout: __Layout,
};