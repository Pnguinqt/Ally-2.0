import CaseAppointments from '../components/CaseAppointments';
import { getAuthData } from '../utils/auth.jsx';
import { useDemoRuntime } from '../demo/DemoContext';

export const AppointmentsPage = () => {
  const demo = useDemoRuntime();
  return <CaseAppointments authData={demo?.auth || getAuthData()} />;
};

export default AppointmentsPage;
