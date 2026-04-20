import "./App.css";
import "./index.css";
import RouteAnalyticsTracker from "./components/RouteAnalyticsTracker";
import RouterConfig from "./router";

export default function App() {
  return (
    <>
      <RouteAnalyticsTracker />
      <RouterConfig />
    </>
  );
}
