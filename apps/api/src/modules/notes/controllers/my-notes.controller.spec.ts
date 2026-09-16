import { MyNotesController } from './my-notes.controller';
import { NotesService } from '../services/notes.service';
import { UsersService } from '../../users/users.service';

describe('MyNotesController', () => {
  let controller: MyNotesController;
  let notesService: {
    listForCaller: jest.Mock;
    findOneForCaller: jest.Mock;
    updateForCaller: jest.Mock;
    deleteForCaller: jest.Mock;
  };
  let usersService: { findByExternalAuthId: jest.Mock };

  beforeEach(() => {
    notesService = {
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
