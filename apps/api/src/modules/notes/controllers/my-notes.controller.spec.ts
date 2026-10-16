import { MyNotesController } from './my-notes.controller';
import { NotesService } from '../services/notes.service';
import { UsersService } from '../../users/users.service';

describe('MyNotesController', () => {
  it('appendEntry() delegates using the authenticated caller without a workspace id', async () => {
    const dto = { content: 'New research update' };
    const response = {
      id: 'note-1',
      tenantId: 'another-tenant',
      entries: [
        {
          id: 'entry-1',
          noteId: 'note-1',
          content: dto.content,
          createdAt: '2026-10-12T06:00:00.000Z',
        },
      ],
    };
    notesService.appendEntryForCaller.mockResolvedValue(response);

    const result = await controller.appendEntry('note-1', req(), dto);

    expect(usersService.findByExternalAuthId).toHaveBeenCalledWith(
      'supabase-user-1',
    );
    expect(notesService.appendEntryForCaller).toHaveBeenCalledWith(
      'note-1',
      'user-1',
      dto,
    );
    expect(result).toBe(response);
  });
  let controller: MyNotesController;
  let notesService: {
    appendEntryForCaller: jest.Mock;
    updateEntryForCaller: jest.Mock;
    deleteEntryForCaller: jest.Mock;
    listForCaller: jest.Mock;
    findOneForCaller: jest.Mock;
    updateForCaller: jest.Mock;
    deleteForCaller: jest.Mock;
  };
  let usersService: { findByExternalAuthId: jest.Mock };

  beforeEach(() => {
    notesService = {
      appendEntryForCaller: jest.fn(),
      updateEntryForCaller: jest.fn(),
      deleteEntryForCaller: jest.fn(),
      listForCaller: jest.fn(),
      findOneForCaller: jest.fn(),
      updateForCaller: jest.fn(),
      deleteForCaller: jest.fn(),
    };
    usersService = {
      findByExternalAuthId: jest.fn().mockResolvedValue({ id: 'user-1' }),
    };
    controller = new MyNotesController(
      notesService as unknown as NotesService,
      usersService as unknown as UsersService,
    );
  });

  function req() {
    return { user: { sub: 'supabase-user-1' } } as never;
  }

  it('updateEntry() delegates using the authenticated caller without a workspace id', async () => {
    const dto = { content: 'Corrected research update' };
    const response = { id: 'note-1', tenantId: 'another-tenant', entries: [] };
    notesService.updateEntryForCaller.mockResolvedValue(response);

    const result = await controller.updateEntry(
      'note-1',
      'entry-1',
      req(),
      dto,
    );

    expect(usersService.findByExternalAuthId).toHaveBeenCalledWith(
      'supabase-user-1',
    );
    expect(notesService.updateEntryForCaller).toHaveBeenCalledWith(
      'note-1',
      'entry-1',
      'user-1',
      dto,
    );
    expect(result).toBe(response);
  });

  it('deleteEntry() delegates to deleteEntryForCaller with the note, entry and caller ids', async () => {
    const response = { id: 'note-1', entries: [] };
    notesService.deleteEntryForCaller.mockResolvedValue(response);

    const result = await controller.deleteEntry('note-1', 'entry-1', req());

    expect(notesService.deleteEntryForCaller).toHaveBeenCalledWith(
      'note-1',
      'entry-1',
      'user-1',
    );
    expect(result).toBe(response);
  });

  it('list() resolves the caller and delegates to listForCaller', async () => {
    notesService.listForCaller.mockResolvedValue([{ id: 'note-1' }]);
    const result = await controller.list(req());
    expect(usersService.findByExternalAuthId).toHaveBeenCalledWith(
      'supabase-user-1',
    );
    expect(notesService.listForCaller).toHaveBeenCalledWith('user-1');
    expect(result).toEqual([{ id: 'note-1' }]);
  });

  it('findOne() delegates to findOneForCaller with the note id and caller id', async () => {
    notesService.findOneForCaller.mockResolvedValue({ id: 'note-1' });
    const result = await controller.findOne('note-1', req());
    expect(notesService.findOneForCaller).toHaveBeenCalledWith(
      'note-1',
      'user-1',
    );
    expect(result).toEqual({ id: 'note-1' });
  });

  it('update() delegates to updateForCaller with the note id, caller id, and body', async () => {
    notesService.updateForCaller.mockResolvedValue({
      id: 'note-1',
      title: 'Updated',
    });
    const result = await controller.update('note-1', req(), {
      title: 'Updated',
    });
    expect(notesService.updateForCaller).toHaveBeenCalledWith(
      'note-1',
      'user-1',
      {
        title: 'Updated',
      },
    );
    expect(result).toEqual({ id: 'note-1', title: 'Updated' });
  });

  it('remove() delegates to deleteForCaller with the note id and caller id', async () => {
    notesService.deleteForCaller.mockResolvedValue({ id: 'note-1' });
    const result = await controller.remove('note-1', req());
    expect(notesService.deleteForCaller).toHaveBeenCalledWith(
      'note-1',
      'user-1',
    );
    expect(result).toEqual({ id: 'note-1' });
  });
});
