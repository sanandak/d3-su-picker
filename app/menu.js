exports.initMenu = function () {
  console.log('in initmenu')
  var win = global.gui.Window.get();
  var menubar = new global.gui.Menu({type: 'menubar'});

  menubar.createMacBuiltin('PSQL')
  win.menu = menubar;

  var fileMenu = new global.gui.Menu();
  fileMenu.append(new global.gui.MenuItem({
    label: 'New',
    click: function () {
      console.log('new file');
    }
  }));
  fileMenu.append(new global.gui.MenuItem({
    label: 'Open',
    key:   'O',
    modifiers: 'cmd'
    //click: function () {
    //  console.log('open file');
    //}
  }));
  fileMenu.append(new global.gui.MenuItem({
    label: 'Save',
    key:   'S',
    modifiers: 'cmd'
  }));

  menubar.append(new global.gui.MenuItem({
    label: 'File',
    submenu: fileMenu
  }));

  var devMenu = new global.gui.Menu();
  devMenu.append(new global.gui.MenuItem({
    label: 'Open DevTools',
    click: function () {
      win.showDevTools();
    }
  }));

  menubar.append(new global.gui.MenuItem({
    label: 'DevTools',
    submenu: devMenu
  }));

  //win.showDevTools();
  console.log('menubar', menubar);

}
