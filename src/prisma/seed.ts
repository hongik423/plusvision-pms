import { PrismaClient, Role } from '@prisma/client';
import { hash } from 'bcryptjs';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { generatePlusPmsId } from '../lib/id';

const prisma = new PrismaClient();

function loadDatabaseUrlFromEnvLocal() {
  if (process.env.DATABASE_URL) {
    return;
  }

  const envLocalPath = resolve(process.cwd(), '.env.local');
  if (!existsSync(envLocalPath)) {
    return;
  }

  const envLocalContent = readFileSync(envLocalPath, 'utf-8');
  const databaseUrlLine = envLocalContent
    .split(/\r?\n/)
    .find((line) => line.trim().startsWith('DATABASE_URL='));

  if (!databaseUrlLine) {
    return;
  }

  const rawValue = databaseUrlLine.slice(databaseUrlLine.indexOf('=') + 1).trim();
  const normalizedValue = rawValue.replace(/^['"]|['"]$/g, '');

  if (normalizedValue) {
    process.env.DATABASE_URL = normalizedValue;
  }
}

async function main() {
  loadDatabaseUrlFromEnvLocal();

  console.log('🌱 시드 데이터 생성 시작...');

  // 1. 관리자 계정 생성 (비밀번호: 브라우저 유출 경고 회피용 프로젝트 전용 형식)
  const adminPassword = await hash('PlusPms1!Adm', 12);
  const admin = await prisma.user.upsert({
    where: { email: 'admin@plusvision.co.kr' },
    update: {
      password: adminPassword,
      role: Role.ADMIN,
      isActive: true,
    },
    create: {
      id: generatePlusPmsId('user'),
      email: 'admin@plusvision.co.kr',
      name: '최봉 (관리자)',
      password: adminPassword,
      role: Role.ADMIN,
      department: '대표이사',
    },
  });
  console.log('✅ 관리자 계정 생성:', admin.email);

  // 2. 테스트 사용자 생성 (브라우저 유출 경고 회피용 프로젝트 전용 비밀번호)
  const managerPassword = await hash('PlusPms1!Mgr', 12);
  const testPassword = await hash('PlusPms1!Tst', 12);
  const commonUserPassword = await hash('PlusPms1!Eng', 12);
  const testUsers = [
    {
      email: 'manager@plusvision.co.kr',
      name: '김매니저',
      role: Role.MANAGER,
      department: '프로젝트관리',
      password: managerPassword,
    },
    {
      email: 'test@plusvision.co.kr',
      name: '테스트 사용자',
      role: Role.USER,
      department: '테스트',
      password: testPassword,
    },
    {
      email: 'engineer1@plusvision.co.kr',
      name: '이엔지니어',
      role: Role.USER,
      department: '제작팀',
      password: commonUserPassword,
    },
    {
      email: 'engineer2@plusvision.co.kr',
      name: '박엔지니어',
      role: Role.USER,
      department: '설치팀',
      password: commonUserPassword,
    },
    {
      email: 'sales@plusvision.co.kr',
      name: '정영업',
      role: Role.USER,
      department: '영업팀',
      password: commonUserPassword,
    },
  ];

  for (const userData of testUsers) {
    await prisma.user.upsert({
      where: { email: userData.email },
      update: {
        name: userData.name,
        role: userData.role,
        department: userData.department,
        password: userData.password,
        isActive: true,
      },
      create: {
        id: generatePlusPmsId('user'),
        ...userData,
      },
    });
  }
  console.log('✅ 테스트 사용자 생성 완료');

  // 3. 고객사
  const customers = [
    { name: '삼성전자', code: 'SEC', contact: '삼성 담당자', phone: '031-000-0000' },
  ];
  for (const data of customers) {
    await prisma.customer.upsert({
      where: { code: data.code },
      update: {},
      create: {
        id: generatePlusPmsId('customer'),
        ...data,
      },
    });
  }
  console.log('✅ 고객사 데이터 생성');

  // 4. 사업장
  const sites = [
    { name: '기흥', code: 'GH', address: '경기도 용인시 기흥구' },
    { name: '화성', code: 'HS', address: '경기도 화성시' },
    { name: '천안', code: 'CA', address: '충청남도 천안시' },
    { name: '평택', code: 'PT', address: '경기도 평택시' },
  ];
  for (const data of sites) {
    await prisma.site.upsert({
      where: { code: data.code },
      update: {},
      create: {
        id: generatePlusPmsId('site'),
        ...data,
      },
    });
  }
  console.log('✅ 사업장 데이터 생성');

  // 5. 공정 유형
  const processTypes = [
    { name: 'CMP', code: 'CMP' },
    { name: 'CVD', code: 'CVD' },
    { name: 'IMP', code: 'IMP' },
    { name: 'ETCH', code: 'ETCH' },
    { name: 'DIFF', code: 'DIFF' },
    { name: '기타', code: 'ETC' },
  ];
  for (const data of processTypes) {
    await prisma.processType.upsert({
      where: { code: data.code },
      update: {},
      create: {
        id: generatePlusPmsId('process_type'),
        ...data,
      },
    });
  }
  console.log('✅ 공정 유형 데이터 생성');

  // 6. 품목 유형
  const itemTypes = [
    { name: '케이블', code: 'CABLE' },
    { name: '컨트롤 시스템', code: 'CTRL' },
    { name: '도어락', code: 'DOOR' },
    { name: '디스플레이', code: 'DISP' },
    { name: '센서', code: 'SENSOR' },
    { name: '기타', code: 'ETC' },
  ];
  for (const data of itemTypes) {
    await prisma.itemType.upsert({
      where: { code: data.code },
      update: {},
      create: {
        id: generatePlusPmsId('item_type'),
        ...data,
      },
    });
  }
  console.log('✅ 품목 유형 데이터 생성');

  // 7. 부품 스펙 (샘플)
  const partSpecs = [
    { category: '케이블', name: 'LVDS 케이블', specification: '30핀, 1.5m', unit: 'EA', unitPrice: 15000 },
    { category: '케이블', name: '파워 케이블', specification: 'AC 220V, 3m', unit: 'EA', unitPrice: 8000 },
    { category: '케이블', name: '시그널 케이블', specification: '50핀, 2m', unit: 'EA', unitPrice: 25000 },
    { category: '디스플레이', name: 'LCD 패널', specification: '10.1인치, 1280x800', unit: 'EA', unitPrice: 120000 },
    { category: '디스플레이', name: 'LED 인디케이터', specification: 'RGB, 24V', unit: 'EA', unitPrice: 3500 },
    { category: '전원', name: 'SMPS 전원', specification: '24V 5A', unit: 'EA', unitPrice: 45000 },
    { category: '전원', name: 'UPS', specification: '1kVA', unit: 'EA', unitPrice: 350000 },
    { category: '컨트롤', name: 'PLC 모듈', specification: 'Mitsubishi FX5U', unit: 'EA', unitPrice: 280000 },
    { category: '컨트롤', name: '릴레이', specification: '24V DC, 10A', unit: 'EA', unitPrice: 5000 },
    { category: '도어락', name: '전자식 도어락', specification: 'RFID 카드형', unit: 'SET', unitPrice: 180000 },
  ];
  for (const data of partSpecs) {
    await prisma.partSpec.create({
      data: {
        id: generatePlusPmsId('part_spec'),
        ...data,
        unitPrice: data.unitPrice,
      },
    });
  }
  console.log('✅ 부품 스펙 데이터 생성');

  console.log('🎉 시드 데이터 생성 완료!');
}

main()
  .catch((e) => {
    console.error('❌ 시드 데이터 생성 실패:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
