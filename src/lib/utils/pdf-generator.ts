import type { Student, Subject, AttendanceSession } from '@/lib/types';
import { createElement, type ReactElement } from 'react';

// Colors
const PRIMARY = '#1e3a5f';
const HEADER_BG = '#f0f4f8';
const BORDER = '#d0d5dd';
const AMBER = '#b45309';
const RED = '#dc2626';
const GREEN = '#16a34a';
const LIGHT_AMBER = '#fef3c7';

function formatDate(d: string) {
  if (!d) return '';
  const dateStr = d.includes('T') ? d : `${d}T00:00:00`;
  const dateObj = new Date(dateStr);
  if (isNaN(dateObj.getTime())) return d;
  return dateObj.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function sortStudentsByOriginalOrder(students: Student[]): Student[] {
  return [...students].sort((a, b) => {
    const timeDiff = (a.uploadedAt ?? '').localeCompare(b.uploadedAt ?? '');
    if (timeDiff !== 0) return timeDiff;
    return a.rollNumber.localeCompare(b.rollNumber);
  });
}

// Helper: createElement shorthand
const h = createElement;

// ─── Student PDF ───────────────────────────────────────────────────────────

export interface StudentPDFParams {
  universityName: string;
  generatedByName: string;
  generatedByRole: string;
  student: Student;
  subjects: Subject[];
  sessions: AttendanceSession[];
  sectionName: string;
  startDate?: string;
  endDate?: string;
  threshold: number;
}

export async function generateStudentPDF(params: StudentPDFParams) {
  const { pdf, Document, Page, Text, View, StyleSheet } = await import(
    '@react-pdf/renderer'
  );

  const {
    universityName,
    generatedByName,
    generatedByRole,
    student,
    subjects,
    sessions,
    sectionName,
    startDate,
    endDate,
    threshold,
  } = params;

  const styles = StyleSheet.create({
    page: { padding: 40, fontSize: 9, fontFamily: 'Helvetica' },
    header: { textAlign: 'center' as const, marginBottom: 16 },
    uniName: { fontSize: 16, fontFamily: 'Helvetica-Bold', color: PRIMARY },
    reportTitle: { fontSize: 12, marginTop: 4, color: '#374151' },
    metaRow: {
      flexDirection: 'row' as const,
      justifyContent: 'space-between' as const,
      marginBottom: 12,
      fontSize: 8,
      color: '#6b7280',
    },
    infoBox: {
      backgroundColor: HEADER_BG,
      padding: 10,
      borderRadius: 4,
      marginBottom: 16,
    },
    infoText: { fontSize: 9, marginBottom: 2 },
    bold: { fontFamily: 'Helvetica-Bold' },
    sectionTitle: {
      fontSize: 10,
      fontFamily: 'Helvetica-Bold',
      marginBottom: 6,
      marginTop: 14,
      color: PRIMARY,
    },
    table: { borderWidth: 1, borderColor: BORDER, marginBottom: 8 },
    tableRow: {
      flexDirection: 'row' as const,
      borderBottomWidth: 1,
      borderBottomColor: BORDER,
    },
    tableHeader: {
      backgroundColor: HEADER_BG,
      fontFamily: 'Helvetica-Bold',
    },
    cell: { padding: 4, fontSize: 8 },
    cellDate: { width: '25%' },
    cellPeriod: { width: '15%' },
    cellStatus: { width: '30%' },
    cellMarkedBy: { width: '30%' },
    summaryBox: {
      padding: 8,
      marginBottom: 6,
      borderRadius: 4,
      backgroundColor: '#f9fafb',
    },
    summaryMeta: { fontSize: 8, marginTop: 2, color: '#374151' },
    dlText: { color: AMBER },
    belowThreshold: { color: RED, fontFamily: 'Helvetica-Bold' },
    aboveThreshold: { color: GREEN, fontFamily: 'Helvetica-Bold' },
    overallBox: {
      marginTop: 20,
      padding: 12,
      backgroundColor: PRIMARY,
      borderRadius: 4,
    },
    overallText: { color: '#ffffff', fontSize: 12, fontFamily: 'Helvetica-Bold', textAlign: 'center' as const },
  });

  // Compute per-subject data
  const subjectData = subjects.map((sub) => {
    const subSessions = sessions
      .filter((s) => s.subjectId === sub.id);
    let present = 0;
    let total = 0;
    let dl = 0;

    const rows = subSessions.map((sess) => {
      const rec = sess.records.find((r) => r.studentId === student.id);
      total++;
      const isDL = rec?.isDutyLeave ?? false;
      const isPresent = rec?.isPresent ?? false;
      if (isDL) {
        dl++;
        present++; // DL counts as present
      } else if (isPresent) {
        present++;
      }
      const status = isDL ? 'DL' : isPresent ? 'Present' : 'Absent';
      return { date: sess.date, period: sess.periodNumber, status, markedBy: sess.createdBy, isDL };
    });

    const pct = total > 0 ? Math.round((present / total) * 100) : 0;
    return { subject: sub, rows, present, total, dl, pct };
  });

  // Overall
  const totalSessions = subjectData.reduce((s, d) => s + d.total, 0);
  const totalPresent = subjectData.reduce((s, d) => s + d.present, 0);
  const totalAbsent = Math.max(totalSessions - totalPresent, 0);
  const overallPct = totalSessions > 0 ? Math.round((totalPresent / totalSessions) * 100) : 0;

  const dateRangeText = `${startDate ? formatDate(startDate) : 'All time'} — ${endDate ? formatDate(endDate) : 'Present'}`;

  const doc = h(
    Document,
    null,
    h(
      Page,
      { size: 'A4', style: styles.page },
      // Header
      h(
        View,
        { style: styles.header },
        h(Text, { style: styles.uniName }, universityName),
        h(Text, { style: styles.reportTitle }, 'Student Attendance Report'),
      ),
      // Meta
      h(
        View,
        { style: styles.metaRow },
        h(Text, null, `Generated: ${new Date().toLocaleDateString('en-IN')}`),
        h(Text, null, `By: ${generatedByName} (${generatedByRole})`),
      ),
      // Student info
      h(
        View,
        { style: styles.infoBox },
        h(Text, { style: [styles.infoText, styles.bold] }, `Name: ${student.fullName}`),
        h(Text, { style: styles.infoText }, `Roll Number: ${student.rollNumber}`),
        h(Text, { style: styles.infoText }, `Section: ${sectionName}`),
        h(Text, { style: styles.infoText }, `Status: ${student.isActive ? 'Active' : 'Inactive'}`),
        h(Text, { style: styles.infoText }, `Date Range: ${dateRangeText}`),
      ),
      // Per subject
      ...subjectData.flatMap((sd) => [
        h(
          Text,
          { style: styles.sectionTitle },
          `${sd.subject.name} (${sd.subject.code})`,
        ),
        sd.rows.length === 0
          ? h(Text, { style: { fontSize: 8, color: '#6b7280', marginBottom: 8 } }, 'No sessions found')
          : h(
              View,
              { style: styles.table },
              // Table header
              h(
                View,
                { style: [styles.tableRow, styles.tableHeader] },
                h(Text, { style: [styles.cell, styles.cellDate] }, 'Date'),
                h(Text, { style: [styles.cell, styles.cellPeriod] }, 'Period'),
                h(Text, { style: [styles.cell, styles.cellStatus] }, 'Status'),
                h(Text, { style: [styles.cell, styles.cellMarkedBy] }, 'Marked By'),
              ),
              // Data rows
              ...sd.rows.map((row, i) =>
                h(
                  View,
                  {
                    key: i,
                    style: [
                      styles.tableRow,
                      row.isDL ? { backgroundColor: LIGHT_AMBER } : {},
                      i === sd.rows.length - 1 ? { borderBottomWidth: 0 } : {},
                    ],
                  },
                  h(Text, { style: [styles.cell, styles.cellDate] }, formatDate(row.date)),
                  h(Text, { style: [styles.cell, styles.cellPeriod] }, `P${row.period}`),
                  h(
                    Text,
                    {
                      style: [
                        styles.cell,
                        styles.cellStatus,
                        row.isDL
                          ? styles.dlText
                          : row.status === 'Present'
                            ? { color: GREEN }
                            : { color: RED },
                      ],
                    },
                    row.status,
                  ),
                  h(
                    Text,
                    { style: [styles.cell, styles.cellMarkedBy] },
                    `${row.markedBy.name} (${row.markedBy.role.replace('_', ' ')})`,
                  ),
                ),
              ),
            ),
        // Summary
        h(
          View,
          { style: styles.summaryBox },
          h(
            Text,
            { style: styles.summaryMeta },
            `Lectures: ${sd.total} | Attended: ${sd.present} | Absent: ${Math.max(sd.total - sd.present, 0)}`,
          ),
          h(
            Text,
            {
              style: sd.pct < threshold ? styles.belowThreshold : styles.aboveThreshold,
            },
            `${sd.pct}% [${sd.pct >= threshold ? 'ABOVE' : 'BELOW'} THRESHOLD]`,
          ),
          sd.dl > 0 ? h(Text, { style: [{ fontSize: 8 }, styles.dlText] }, `(${sd.dl} Duty Leave sessions)`) : null,
        ),
      ]),
      // Overall
      h(
        View,
        { style: styles.overallBox },
        h(Text, { style: styles.overallText }, `Total Lectures: ${totalSessions} | Attended: ${totalPresent} | Absent: ${totalAbsent}`),
        h(Text, { style: styles.overallText }, `Overall Attendance: ${overallPct}%`),
      ),
    ),
  ) as ReactElement;

  const blob = await pdf(doc).toBlob();
  triggerDownload(blob, `Student_Report_${student.rollNumber}_${student.fullName.replace(/\s+/g, '_')}.pdf`);
}

// ─── Subject PDF ───────────────────────────────────────────────────────────

export interface SubjectPDFParams {
  universityName: string;
  generatedByName: string;
  generatedByRole: string;
  subject: Subject;
  students: Student[];
  sessions: AttendanceSession[];
  sectionName: string;
  startDate?: string;
  endDate?: string;
  threshold: number;
}

export async function generateSubjectPDF(params: SubjectPDFParams) {
  const { pdf, Document, Page, Text, View, StyleSheet } = await import(
    '@react-pdf/renderer'
  );

  const {
    universityName,
    generatedByName,
    generatedByRole,
    subject,
    students,
    sessions: allSessions,
    sectionName,
    startDate,
    endDate,
    threshold,
  } = params;

  const subSessions = allSessions
    .filter((s) => s.subjectId === subject.id);

  const styles = StyleSheet.create({
    page: { padding: 40, fontSize: 9, fontFamily: 'Helvetica' },
    header: { textAlign: 'center' as const, marginBottom: 16 },
    uniName: { fontSize: 16, fontFamily: 'Helvetica-Bold', color: PRIMARY },
    reportTitle: { fontSize: 12, marginTop: 4, color: '#374151' },
    metaRow: {
      flexDirection: 'row' as const,
      justifyContent: 'space-between' as const,
      marginBottom: 12,
      fontSize: 8,
      color: '#6b7280',
    },
    infoBox: {
      backgroundColor: HEADER_BG,
      padding: 10,
      borderRadius: 4,
      marginBottom: 16,
    },
    infoText: { fontSize: 9, marginBottom: 2 },
    bold: { fontFamily: 'Helvetica-Bold' },
    sectionTitle: {
      fontSize: 10,
      fontFamily: 'Helvetica-Bold',
      marginBottom: 6,
      marginTop: 14,
      color: PRIMARY,
    },
    table: { borderWidth: 1, borderColor: BORDER, marginBottom: 8 },
    tableRow: {
      flexDirection: 'row' as const,
      borderBottomWidth: 1,
      borderBottomColor: BORDER,
    },
    tableHeader: {
      backgroundColor: HEADER_BG,
      fontFamily: 'Helvetica-Bold',
    },
    cell: { padding: 4, fontSize: 8 },
    cellRoll: { width: '20%' },
    cellName: { width: '40%' },
    cellStatus: { width: '40%' },
    // Summary table columns
    sumRoll: { width: '15%' },
    sumName: { width: '21%' },
    sumSessions: { width: '11%' },
    sumPresent: { width: '12%' },
    sumAbsent: { width: '11%' },
    sumPct: { width: '10%' },
    sumStatus: { width: '20%' },
    dlText: { color: AMBER },
    belowThreshold: { color: RED, fontFamily: 'Helvetica-Bold' },
    aboveThreshold: { color: GREEN },
    summaryBox: {
      padding: 6,
      marginBottom: 4,
      backgroundColor: '#f9fafb',
      borderRadius: 4,
      fontSize: 8,
    },
  });

  const dateRangeText = `${startDate ? formatDate(startDate) : 'All time'} — ${endDate ? formatDate(endDate) : 'Present'}`;
  const sortedStudents = sortStudentsByOriginalOrder(students);

  // Per-session pages
  const sessionBlocks = subSessions.map((sess) => {
    let presentCount = 0;
    let dlCount = 0;
    const rows = sortedStudents.map((stu) => {
      const rec = sess.records.find((r) => r.studentId === stu.id);
      const isDL = rec?.isDutyLeave ?? false;
      const isPresent = rec?.isPresent ?? false;
      if (isDL) { dlCount++; presentCount++; }
      else if (isPresent) { presentCount++; }
      const status = isDL ? 'DL' : isPresent ? 'Present' : 'Absent';
      return { roll: stu.rollNumber, name: stu.fullName, status, isDL };
    });
    const total = sortedStudents.length;
    const pct = total > 0 ? Math.round((presentCount / total) * 100) : 0;
    return { sess, rows, presentCount, dlCount, total, pct };
  });

  // Student summary
  const studentSummary = sortedStudents.map((stu) => {
    let present = 0;
    const total = subSessions.length;
    subSessions.forEach((sess) => {
      const rec = sess.records.find((r) => r.studentId === stu.id);
      if (rec?.isDutyLeave || rec?.isPresent) present++;
    });
    const absent = Math.max(total - present, 0);
    const pct = total > 0 ? Math.round((present / total) * 100) : 0;
    return { roll: stu.rollNumber, name: stu.fullName, total, present, absent, pct, belowThreshold: pct < threshold };
  });

  const doc = h(
    Document,
    null,
    h(
      Page,
      { size: 'A4', style: styles.page },
      // Header
      h(
        View,
        { style: styles.header },
        h(Text, { style: styles.uniName }, universityName),
        h(Text, { style: styles.reportTitle }, 'Subject Attendance Report'),
      ),
      h(
        View,
        { style: styles.metaRow },
        h(Text, null, `Generated: ${new Date().toLocaleDateString('en-IN')}`),
        h(Text, null, `By: ${generatedByName} (${generatedByRole})`),
      ),
      h(
        View,
        { style: styles.infoBox },
        h(Text, { style: [styles.infoText, styles.bold] }, `Subject: ${subject.name} (${subject.code})`),
        h(Text, { style: styles.infoText }, `Section: ${sectionName}`),
        h(Text, { style: styles.infoText }, `Date Range: ${dateRangeText}`),
        h(Text, { style: styles.infoText }, `Total Sessions: ${subSessions.length}`),
      ),
      // Per-session tables
      ...sessionBlocks.flatMap((sb) => [
        h(
          Text,
          { style: styles.sectionTitle },
          `${formatDate(sb.sess.date)} — Period ${sb.sess.periodNumber}`,
        ),
        h(
          View,
          { style: styles.table },
          h(
            View,
            { style: [styles.tableRow, styles.tableHeader] },
            h(Text, { style: [styles.cell, styles.cellRoll] }, 'Roll'),
            h(Text, { style: [styles.cell, styles.cellName] }, 'Name'),
            h(Text, { style: [styles.cell, styles.cellStatus] }, 'Status'),
          ),
          ...sb.rows.map((row, i) =>
            h(
              View,
              {
                key: i,
                style: [
                  styles.tableRow,
                  row.isDL ? { backgroundColor: LIGHT_AMBER } : {},
                  i === sb.rows.length - 1 ? { borderBottomWidth: 0 } : {},
                ],
              },
              h(Text, { style: [styles.cell, styles.cellRoll] }, row.roll),
              h(Text, { style: [styles.cell, styles.cellName] }, row.name),
              h(
                Text,
                {
                  style: [
                    styles.cell,
                    styles.cellStatus,
                    row.isDL
                      ? styles.dlText
                      : row.status === 'Present'
                        ? { color: GREEN }
                        : { color: RED },
                  ],
                },
                row.status,
              ),
            ),
          ),
        ),
        h(
          View,
          { style: styles.summaryBox },
          h(
            Text,
            null,
            `${sb.presentCount}/${sb.total} present (${sb.pct}%) | ${sb.dlCount} DL — Marked by: ${sb.sess.createdBy.name} (${sb.sess.createdBy.role.replace('_', ' ')})`,
          ),
        ),
      ]),
    ),
    // Student summary page
    h(
      Page,
      { size: 'A4', style: styles.page },
      h(Text, { style: styles.sectionTitle }, 'Student Summary'),
      h(
        View,
        { style: styles.table },
        h(
          View,
          { style: [styles.tableRow, styles.tableHeader] },
          h(Text, { style: [styles.cell, styles.sumRoll] }, 'Roll'),
          h(Text, { style: [styles.cell, styles.sumName] }, 'Name'),
          h(Text, { style: [styles.cell, styles.sumSessions] }, 'Lectures'),
          h(Text, { style: [styles.cell, styles.sumPresent] }, 'Attended'),
          h(Text, { style: [styles.cell, styles.sumAbsent] }, 'Absent'),
          h(Text, { style: [styles.cell, styles.sumPct] }, '%'),
          h(Text, { style: [styles.cell, styles.sumStatus] }, 'Status'),
        ),
        ...studentSummary.map((row, i) =>
          h(
            View,
            {
              key: i,
              style: [
                styles.tableRow,
                i === studentSummary.length - 1 ? { borderBottomWidth: 0 } : {},
              ],
            },
            h(Text, { style: [styles.cell, styles.sumRoll] }, row.roll),
            h(Text, { style: [styles.cell, styles.sumName] }, row.name),
            h(Text, { style: [styles.cell, styles.sumSessions] }, `${row.total}`),
            h(Text, { style: [styles.cell, styles.sumPresent] }, `${row.present}`),
            h(Text, { style: [styles.cell, styles.sumAbsent] }, `${row.absent}`),
            h(Text, { style: [styles.cell, styles.sumPct] }, `${row.pct}%`),
            h(
              Text,
              {
                style: [
                  styles.cell,
                  styles.sumStatus,
                  row.belowThreshold ? styles.belowThreshold : styles.aboveThreshold,
                ],
              },
              row.belowThreshold ? 'BELOW THRESHOLD' : 'OK',
            ),
          ),
        ),
      ),
    ),
  ) as ReactElement;

  const blob = await pdf(doc).toBlob();
  triggerDownload(blob, `Subject_Report_${subject.code}_${subject.name.replace(/\s+/g, '_')}.pdf`);
}

// ─── Section PDF ───────────────────────────────────────────────────────────

export interface SectionPDFParams {
  universityName: string;
  generatedByName: string;
  generatedByRole: string;
  sectionName: string;
  branchName: string;
  subjects: Subject[];
  students: Student[];
  sessions: AttendanceSession[];
  startDate?: string;
  endDate?: string;
  threshold: number;
}

export async function generateSectionPDF(params: SectionPDFParams) {
  const { pdf, Document, Page, Text, View, StyleSheet } = await import(
    '@react-pdf/renderer'
  );

  const {
    universityName,
    generatedByName,
    generatedByRole,
    sectionName,
    branchName,
    subjects,
    students,
    sessions,
    startDate,
    endDate,
    threshold,
  } = params;

  const sortedStudents = sortStudentsByOriginalOrder(students);
  const dateRangeText = `${startDate ? formatDate(startDate) : 'All time'} — ${endDate ? formatDate(endDate) : 'Present'}`;

  // Compute matrix: student x subject => percentage
  const matrix = sortedStudents.map((stu) => {
    const subjectPcts = subjects.map((sub) => {
      const subSessions = sessions.filter((s) => s.subjectId === sub.id);
      const total = subSessions.length;
      let present = 0;
      subSessions.forEach((sess) => {
        const rec = sess.records.find((r) => r.studentId === stu.id);
        if (rec?.isDutyLeave || rec?.isPresent) present++;
      });
      const pct = total > 0 ? Math.round((present / total) * 100) : -1; // -1 = no sessions
      return pct;
    });

    // Overall
    const totalSess = sessions.length;
    let totalPresent = 0;
    sessions.forEach((sess) => {
      const rec = sess.records.find((r) => r.studentId === stu.id);
      if (rec?.isDutyLeave || rec?.isPresent) totalPresent++;
    });
    const overallPct = totalSess > 0 ? Math.round((totalPresent / totalSess) * 100) : 0;

    return { student: stu, subjectPcts, overallPct };
  });

  const defaultersCount = matrix.filter((m) => m.overallPct < threshold).length;
  // Dynamic column widths
  const nameColWidth = 30;
  const overallColWidth = 10;
  const remainingWidth = 60;
  const subColWidth = subjects.length > 0 ? Math.min(remainingWidth / subjects.length, 15) : 10;

  const styles = StyleSheet.create({
    page: { padding: 30, fontSize: 8, fontFamily: 'Helvetica' },
    header: { textAlign: 'center' as const, marginBottom: 16 },
    uniName: { fontSize: 16, fontFamily: 'Helvetica-Bold', color: PRIMARY },
    reportTitle: { fontSize: 12, marginTop: 4, color: '#374151' },
    metaRow: {
      flexDirection: 'row' as const,
      justifyContent: 'space-between' as const,
      marginBottom: 12,
      fontSize: 8,
      color: '#6b7280',
    },
    infoBox: {
      backgroundColor: HEADER_BG,
      padding: 10,
      borderRadius: 4,
      marginBottom: 16,
    },
    infoText: { fontSize: 9, marginBottom: 2 },
    bold: { fontFamily: 'Helvetica-Bold' },
    table: { borderWidth: 1, borderColor: BORDER, marginBottom: 8 },
    tableRow: {
      flexDirection: 'row' as const,
      borderBottomWidth: 1,
      borderBottomColor: BORDER,
    },
    tableHeader: {
      backgroundColor: HEADER_BG,
      fontFamily: 'Helvetica-Bold',
    },
    cell: { padding: 3, fontSize: 7 },
    nameCell: { width: `${nameColWidth}%` },
    subCell: { width: `${subColWidth}%`, textAlign: 'center' as const },
    overallCell: { width: `${overallColWidth}%`, textAlign: 'center' as const, fontFamily: 'Helvetica-Bold' },
    dlText: { color: AMBER },
    belowThreshold: { color: RED },
    aboveThreshold: { color: GREEN },
    footer: {
      marginTop: 16,
      padding: 10,
      backgroundColor: '#fef2f2',
      borderRadius: 4,
    },
    footerText: { fontSize: 10, fontFamily: 'Helvetica-Bold', color: RED },
  });

  const doc = h(
    Document,
    null,
    h(
      Page,
      { size: 'A4', orientation: subjects.length > 5 ? 'landscape' : 'portrait', style: styles.page },
      // Header
      h(
        View,
        { style: styles.header },
        h(Text, { style: styles.uniName }, universityName),
        h(Text, { style: styles.reportTitle }, 'Section Attendance Report'),
      ),
      h(
        View,
        { style: styles.metaRow },
        h(Text, null, `Generated: ${new Date().toLocaleDateString('en-IN')}`),
        h(Text, null, `By: ${generatedByName} (${generatedByRole})`),
      ),
      h(
        View,
        { style: styles.infoBox },
        h(Text, { style: [styles.infoText, styles.bold] }, `Section: ${sectionName}`),
        h(Text, { style: styles.infoText }, `Branch: ${branchName}`),
        h(Text, { style: styles.infoText }, `Date Range: ${dateRangeText}`),
        h(Text, { style: styles.infoText }, `Total Lectures: ${sessions.length}`),
        h(Text, { style: styles.infoText }, `Students: ${sortedStudents.length} | Subjects: ${subjects.length} | Threshold: ${threshold}%`),
      ),
      // Matrix table
      h(
        View,
        { style: styles.table },
        // Header row
        h(
          View,
          { style: [styles.tableRow, styles.tableHeader] },
          h(Text, { style: [styles.cell, styles.nameCell] }, 'Student'),
          ...subjects.map((sub, i) =>
            h(Text, { key: i, style: [styles.cell, styles.subCell] }, sub.code),
          ),
          h(Text, { style: [styles.cell, styles.overallCell] }, 'Overall'),
        ),
        // Data rows
        ...matrix.map((row, i) =>
          h(
            View,
            {
              key: i,
              style: [
                styles.tableRow,
                i === matrix.length - 1 ? { borderBottomWidth: 0 } : {},
              ],
            },
            h(
              Text,
              { style: [styles.cell, styles.nameCell] },
              `${row.student.rollNumber} - ${row.student.fullName}`,
            ),
            ...row.subjectPcts.map((pct, j) =>
              h(
                Text,
                {
                  key: j,
                  style: [
                    styles.cell,
                    styles.subCell,
                    pct >= 0 && pct < threshold ? styles.belowThreshold : {},
                  ],
                },
                pct < 0 ? '-' : `${pct}%${pct < threshold ? ' \u26A0' : ''}`,
              ),
            ),
            h(
              Text,
              {
                style: [
                  styles.cell,
                  styles.overallCell,
                  row.overallPct < threshold ? styles.belowThreshold : styles.aboveThreshold,
                ],
              },
              `${row.overallPct}%`,
            ),
          ),
        ),
      ),
      // Footer
      h(
        View,
        { style: styles.footer },
        h(
          Text,
          { style: styles.footerText },
          `Defaulters (below ${threshold}%): ${defaultersCount} student${defaultersCount !== 1 ? 's' : ''}`,
        ),
      ),
    ),
  ) as ReactElement;

  const blob = await pdf(doc).toBlob();
  triggerDownload(blob, `Section_Report_${sectionName.replace(/\s+/g, '_')}.pdf`);
}
