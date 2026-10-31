/**
 * Demo workers and administrators. Not real people.
 */
import type { Worker, Admin } from '../../shared/types';
import { hashSecret } from '../auth/password';

export async function generatePeople(): Promise<{ workers: Worker[]; admins: Admin[] }> {
  // Common demo credentials
  const defaultPinHash = await hashSecret('1234');
  const defaultAdminPasswordHash = await hashSecret('Admin@1234');

  const workers: Worker[] = [];

  // Primary demo worker 1: Construction Mason (Hindi)
  workers.push({
    id: 'worker-ramesh',
    orgId: 'org-construction',
    siteId: 'site-skyline-chennai',
    name: 'Ramesh Kumar',
    phone: '9876543210',
    pinHash: defaultPinHash,
    role: 'mason',
    payType: 'daily',
    basePay: 750,
    allowances: 250,
    team: 'Masonry',
    locale: 'hi',
    active: true,
  });

  // Construction workers (29 additional workers)
  const constructionRoles: Worker['role'][] = ['mason', 'helper', 'electrician', 'plumber'];
  const constructionTeams = ['Masonry', 'Electrical', 'Scaffolding', 'Earthworks'];
  const constructionNames = [
    'Rajesh Yadav',
    'Suresh Sharma',
    'Amit Verma',
    'Vikas Patel',
    'Manoj Tiwari',
    'Deepak Singh',
    'Dinesh Rawat',
    'Ajay Meena',
    'Pradeep Paswan',
    'Santosh Sahni',
    'Mohan Lal',
    'Anil Kumar',
    'Govind Prasad',
    'Rakesh Mandal',
    'Sunil Chauhan',
    'Babloo Soren',
    'Munna Ansari',
    'Subhash Yadav',
    'Guddu Kumar',
    'Pankaj Mishra',
    'Kallu Ram',
    'Chhotu Pandit',
    'Dharmendra Pal',
    'Suraj Bind',
    'Vijay Kewat',
    'Sonu Vishwakarma',
    'Karan Oraon',
    'Mahesh Gond',
    'Kamlesh Bind',
  ];

  for (let i = 0; i < constructionNames.length; i++) {
    const role = constructionRoles[i % constructionRoles.length];
    const team = constructionTeams[i % constructionTeams.length];
    const isMonthly = i % 4 === 0;
    workers.push({
      id: `worker-const-${i + 1}`,
      orgId: 'org-construction',
      siteId: 'site-skyline-chennai',
      name: constructionNames[i],
      phone: `98765432${(i + 11).toString().padStart(2, '0')}`,
      pinHash: defaultPinHash,
      role,
      payType: isMonthly ? 'monthly' : 'daily',
      basePay: isMonthly ? 20000 + i * 300 : 650 + (i % 5) * 50,
      allowances: isMonthly ? 1500 : 200,
      team,
      locale: i % 2 === 0 ? 'hi' : 'en',
      active: true,
    });
  }

  // Primary demo worker 2: College Housekeeping (Tamil)
  workers.push({
    id: 'worker-murugan',
    orgId: 'org-college',
    siteId: 'site-srm-campus',
    name: 'Murugan Swaminathan',
    phone: '9123456789',
    pinHash: defaultPinHash,
    role: 'housekeeping',
    payType: 'monthly',
    basePay: 18500,
    allowances: 1500,
    team: 'Housekeeping',
    locale: 'ta',
    active: true,
  });

  // College workers (19 additional workers)
  const collegeRoles: Worker['role'][] = ['housekeeping', 'security', 'maintenance', 'plumber'];
  const collegeTeams = ['Housekeeping', 'Security', 'Maintenance'];
  const collegeNames = [
    'Anbarasan K',
    'Kavitha S',
    'Selvi M',
    'Saravanan P',
    'Balan R',
    'Prakash V',
    'Munisamy T',
    'Karthik N',
    'Malarvizhi D',
    'Ganesan C',
    'Venkatesh S',
    'Manikandan B',
    'Thangaraj E',
    'Kannan L',
    'Sudha A',
    'Pandian G',
    'Meenakshi R',
    'Vijayalakshmi K',
    'Dhanasekaran J',
  ];

  for (let i = 0; i < collegeNames.length; i++) {
    const role = collegeRoles[i % collegeRoles.length];
    const team = collegeTeams[i % collegeTeams.length];
    const isMonthly = i % 2 === 0;
    workers.push({
      id: `worker-coll-${i + 1}`,
      orgId: 'org-college',
      siteId: 'site-srm-campus',
      name: collegeNames[i],
      phone: `91234567${(i + 10).toString().padStart(2, '0')}`,
      pinHash: defaultPinHash,
      role,
      payType: isMonthly ? 'monthly' : 'daily',
      basePay: isMonthly ? 17500 + i * 250 : 600 + (i % 4) * 40,
      allowances: isMonthly ? 1200 : 150,
      team,
      locale: i % 3 === 0 ? 'en' : 'ta',
      active: true,
    });
  }

  // Demo administrators
  const admins: Admin[] = [
    {
      id: 'admin-skyline',
      orgId: 'org-construction',
      name: 'Arunachalam Verma (Site Ops Lead)',
      email: 'admin.skyline@fairshift.org',
      passwordHash: defaultAdminPasswordHash,
    },
    {
      id: 'admin-campus',
      orgId: 'org-college',
      name: 'Dr. Priya Sundaram (Facilities Director)',
      email: 'admin.campus@fairshift.org',
      passwordHash: defaultAdminPasswordHash,
    },
    {
      // Regional HR lead with access to both organisations: demonstrates the sector switcher.
      id: 'admin-regional',
      orgId: 'org-construction',
      orgIds: ['org-construction', 'org-college'],
      name: 'Kavya Raman (Regional HR Lead)',
      email: 'admin.regional@fairshift.org',
      passwordHash: defaultAdminPasswordHash,
    },
  ];

  // Demo UPI IDs on a bank handle that does not exist: a UPI app opens with the payee and amount
  // filled in, but no real person can receive a payment made from the demo.
  for (const worker of workers) {
    worker.upiId = `${worker.name.toLowerCase().replace(/[^a-z]+/g, '.')}@fairshiftdemo`;
  }

  return { workers, admins };
}
