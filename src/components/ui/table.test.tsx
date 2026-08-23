import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Table, TableHeader, TableRow, TableHead } from '@/components/ui/table';

describe('TableHead (a11y semantics)', () => {
  it('renders header cells with scope="col" so screen readers associate them with data columns', () => {
    render(
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Roll Number</TableHead>
            <TableHead>Full Name</TableHead>
          </TableRow>
        </TableHeader>
      </Table>
    );

    const headers = screen.getAllByRole('columnheader');
    expect(headers).toHaveLength(2);
    for (const th of headers) {
      expect(th).toHaveAttribute('scope', 'col');
    }
  });
});
