$(document).ready(function() {
  /*
   * Globals
   */
  var socket = io.connect();
  socket.reconnect = true;
  var lighting;
  var power = {};
  /*
   * Respond to socket events
   */
  socket.on('connect', function() {
    $("#server-status")
      .removeClass("btn-danger")
      .addClass("btn-success")
      .addClass("disabled")
      .text("Connected")
      .button("refresh");
  });
  socket.on('emitBrightness', function(data) {
    lighting = data;
    $("#brightness-slider").slider('value', parseInt(lighting.brightness));
  });
  socket.on('emitPreset', function(data) {
    lighting = data;
    $('.btn-preset').removeClass('btn-preset-active').addClass('btn-preset-inactive');
    $('#preset-button-' + lighting.preset).removeClass('btn-preset-inactive').addClass('btn-preset-active').button('refresh');
  });

  socket.on('emit-power-switches', function(data) {
    power.switches = data;

    var pswitch_rows = [];
    var pswitch_buttons = [];
    $.each(power.switches, function(index, pswitch) {
      if (!pswitch) {
        return;
      }
      pswitch_rows.push($('<tr>')
        .append($('<td>', {style: 'text-align: center'}).text(index))
        .append($('<td>').text(pswitch.description))
        .append($('<td>')
          .append($('<button>', {
              'class': 'btn btn-info btn-block open-modal-edit-power-switch',
              'data-toggle': 'modal',
              'data-target': '#modal-edit-power-switch',
              'data-id': index,
              'data-description': pswitch.description,
            })
            .text('Edit')
          )
        )
        .append($('<td>')
          .append($('<button>', {
            'class': 'btn btn-danger btn-block open-modal-delete-power-switch',
            'data-toggle': 'modal',
            'data-target': '#modal-delete-power-switch',
            'data-id': index,
            })
            .text('Delete')
          )
        )
      )
      pswitch_buttons.push($('<tr>')
        .append($('<td>', {'stype': 'text-align: center'}).text(index))
        .append($('<td>').text(pswitch.description))
        .append($('<td>')
          .append($('<button>', {
            'class': 'btn btn-success btn-block set-power-switch',
            'data-target': '.set-power-switch',
            'data-id': index,
            'data-action': 'on'
          })
          .text('On')
          )
        )
        .append($('<td>')
          .append($('<button>', {
            'class': 'btn btn-danger btn-block set-power-switch',
            'data-target': '.set-power-switch',
            'data-id': index,
            'data-action': 'off'
          })
          .text('Off')
          )
        )
      );
    });
    /*
     * Now generate the finished table.
     */
    $('#power-switch-buttons').empty();
    $('#power-switch-buttons')
      .append($('<table>', {"class": "table table-striped table-bordered"})
        .append($('<thead>')
          .append($('<tr>')
            .append($('<th>').text('Switch ID'))
            .append($('<th>').text('Description'))
            .append($('<th>').attr('colspan', 2).text('Control'))
          )
        )
        .append($('<tbody>')
          .append(pswitch_buttons)
        )
      );
    $('#list-power-switches').empty();
    $('#list-power-switches')
      .append($('<table>', {"class": "table table-striped table-bordered"})
        .append($('<thead>')
          .append($('<tr>')
            .append($('<th>').text('Switch ID'))
            .append($('<th>').text('Description'))
            .append($('<th>').attr('colspan', 2).text('Modify'))
          )
        )
        .append($('<tbody>')
          .append(pswitch_rows)
        )
      );
  });

  /*
   * Upon receipt of an emitPresets event, replace the #list-presets table with
   * an updated version
   */
  socket.on('emitPresets', function(data) {
    lighting = data;
    /*
     * Build up the table rows first.
     */
    var presetrows = [];
    $.each(lighting.presets, function(index, preset) {
      /*
       * Update preset buttons on main page
       */
      $('#preset-button-' + index).html(preset['name']);
      presetrows.push($('<tr>')
        .append($('<td>', {style: 'text-align: center'}).text(index + 1))
        .append($('<td>').text(preset['name']))
        .append($('<td>').text(preset['description']))
        .append($('<td>')
          .append($('<button>', {
              'class': 'btn btn-info btn-block open-modal-edit-preset',
              'data-toggle': 'modal',
              'data-target': '#modal-edit-preset',
              'data-id': index,
              'data-name': preset['name'],
              'data-description': preset['description'],
            })
            .text('Edit')
          )
        )
        .append($('<td>')
          .append($('<button>', {
            'class': 'btn btn-danger btn-block open-modal-save-preset',
            'data-toggle': 'modal',
            'data-target': '#modal-save-preset',
            'data-id': index,
            })
            .text('Save')
          )
        )
      )
    });
    /*
     * Now generate the finished table.
     */
    $('#list-presets').empty();
    $('#list-presets')
      .append($('<table>', {"class": "table table-striped table-bordered"})
        .append($('<thead>')
          .append($('<tr>')
            .append($('<th>').text('Preset ID'))
            .append($('<th>').text('Name'))
            .append($('<th>').text('Description'))
            .append($('<th>').attr('colspan', 2).text('Modify'))
          )
        )
        .append($('<tbody>')
          .append(presetrows)
        )
      );
  });

  /*
   * Upon receipt of an emitZones event, replace the #list-zones table with
   * an updated version
   */
  socket.on('emitZones', function(data) {
    lighting = data;
    /*
     * Build up the table rows first.
     */
    var zonerows = [];
    $.each(lighting.zones, function(index, zone) {
      if (!zone) {
        return true;
      }
      var zonelights;
      zone["lights"].forEach(function(light) {
        var addr = light - 1; // display vs array offset
        var desc;
        if (lighting.lights[addr] && lighting.lights[addr]["description"]) {
          desc = lighting.lights[addr].description;
        } else {
          desc = light;
        }
        if (zonelights) {
          zonelights += '<br/>' + desc;
        } else {
          zonelights = desc;
        }
      });
      zonerows.push($('<tr>')
        .append($('<td>', {style: "text-align: center"}).text(zone["id"]))
        .append($('<td>').text(zone["name"]))
        .append($('<td>').html(zonelights))
        .append($('<td>').text(zone["description"]))
        .append($('<td>', {
          'id': "zone-bgcol-" + zone.id,
          'style': "background: " + zone["colour"]
        }))
        .append($('<td>')
          .append($('<button>', {
              'class': 'btn btn-info btn-block open-modal-change-colour',
              'data-toggle': 'modal',
              'data-target': '#modal-change-colour',
              'data-id': index,
            })
            .text('Colour')
          )
        )
        .append($('<td>')
          .append($('<button>', {
              'class': 'btn btn-info btn-block open-modal-edit-zone',
              'data-toggle': 'modal',
              'data-target': '#modal-edit-zone',
              'data-id': zone.id,
              'data-name': zone['name'],
              'data-description': zone['description'],
            })
            .text('Edit')
          )
        )
        .append($('<td>')
          .append($('<button>', {
              'class': 'btn btn-danger btn-block open-modal-delete-zone',
              'data-toggle': 'modal',
              'data-target': '#modal-delete-zone',
              'data-id': zone.id,
            })
            .text('Delete')
          )
        )
      )
    });
    /*
     * Now generate the finished table.
     */
    $('#list-zones').empty();
    $('#list-zones')
      .append($('<table>', {"class": "table table-striped table-bordered"})
        .append($('<thead>')
          .append($('<tr>')
            .append($('<th>', {"class": "text-center"}).text('#'))
            .append($('<th>').text('Name'))
            .append($('<th>').text('Lights'))
            .append($('<th>').text('Description'))
            .append($('<th>').text('Colour'))
            .append($('<th>').attr('colspan', 3).text('Modify'))
          )
        )
        .append($('<tbody>')
          .append(zonerows)
        )
      );
  });
  socket.on('emitLights', function(data) {
    lighting = data;
    var lightToName = {
      "rgb": "RGB",
      "par8": "PAR8",
      "single": "Single"
    }
    var lightrows = [];
    var lightboxes = [];
    var uplightboxes = [];
    $.each(lighting.lights, function(index, light) {
      var addr = index + 1;
      if (!light || light.type === undefined || !(lightToName[light.type])) {
        return true;
      }
      lightboxes.push($('<input>', {type: "checkbox", name: "lights[]", value: addr}))
      uplightboxes.push($('<input>', {type: "checkbox", id: "light-checkbox-" + addr, name: "lights[]", value: addr}))
      if (light.description) {
        lightboxes.push(' ' + light.description);
        uplightboxes.push(' ' + light.description);
      } else {
        lightboxes.push(' ' + addr);
        uplightboxes.push(' ' + addr);
      }
      lightboxes.push('<br>')
      uplightboxes.push('<br>')
      switch (light.type) {
      case 'single':
        var ids = addr;
        break;
      case 'rgb':
        var ids = addr + ' - ' + (addr + 2);
        break;
      case 'par8':
        var ids = addr + ' - ' + (addr + 7);
        break;
      }
      lightrows.push($('<tr>')
        .append($('<td>', {style: "text-align: center"}).text(ids))
        .append($('<td>').text(lightToName[light.type]))
        .append($('<td>').text(light.description))
        .append($('<td>')
          .append($('<button>', {
              'class': 'btn btn-info btn-block open-modal-edit-light',
              'data-toggle': 'modal',
              'data-target': '#modal-edit-light',
              'data-id': index,
              'data-description': light['description'],
            })
            .text('Edit')
          )
        )
        .append($('<td>')
          .append($('<button>', {
              'class': 'btn btn-danger btn-block open-modal-delete-light',
              'data-toggle': 'modal',
              'data-target': '#modal-delete-light',
              'data-id': index,
            })
            .text('Delete')
          )
        )
      )
    });
    $('#list-lights').empty();
    $('#list-lights')
      .append($('<table>', {"class": "table table-striped table-bordered"})
        .append($('<thead>')
          .append($('<tr>')
            .append($('<th>', {"class": "pagination-centered"}).text('DMX Channels'))
            .append($('<th>').text('Type'))
            .append($('<th>').text('Description'))
            .append($('<th>').attr('colspan', 2).text('Modify'))
          )
        )
        .append($('<tbody>')
          .append(lightrows)
        )
      );
    $('#lightsCheckboxList').empty();
    $('#lightsCheckboxList').append($('<p>').append(lightboxes));
    $('#zone-lights-list').empty();
    $('#zone-lights-list').append($('<p>').append(uplightboxes));
  });
  socket.on('disconnect', function() {
    $("#server-status")
      .removeClass("btn-success")
      .removeClass("disabled")
      .addClass("btn-danger")
      .text("Disconnected!  Click to reconnect.")
      .button("refresh");
  });
  $("#server-status").click(function() {
    socket.socket.reconnect();
  });
  /*
   * Buttons for turning brightness up full or off.
   */
  $("#brightness-on").on('click', function() {
    socket.socket.reconnect();
    socket.emit('setBrightness', 100);
    $('#brightness-slider').slider('value', 100);
  });
  $("#brightness-off").on('click', function() {
    socket.socket.reconnect();
    socket.emit('setBrightness', 0);
    $('#brightness-slider').slider('value', 0);
  });
  /*
   * Set overall brightness via main slider
   */
  $('#brightness-slider').slider({
    orientation: "vertical",
    range: "min",
    min: 0,
    max: 100,
    step: 1,
    value: 60,
    slide: function (ev, ui) {
      socket.socket.reconnect();
      socket.emit('setBrightness', ui.value);
    }
  });
  /*
   * Support draggable
   */
  $('#brightness-slider').draggable();
  $.getJSON('/api/lighting/zones', function(data) {
    var z = [];
    $.each(data, function(index, zone) {
      if (!zone) {
        return true;
      }
      z.push('<li id="' + index + '">' + zone["name"] + '</li>');
    });
    $('<ul/>', {
      html: z.join('')
    }).html('#zones');
  });

  /* XXX: really?? */
  $('#createNewZone input').keydown(function(e) {
    if (e.keyCode == 13) {
      $('#createNewZone').submit();
    }
  });
  $('#addNewZone').on('shown', function () {
    $('input:text:visible:first', this).focus();
  });
  $('#createNewZone').on('submit', function(event) {
    $.ajax({
      type: "POST",
      url: "/api/lighting/zones",
      data: $(this).serialize(),
      /*
      success:function() {
        $(':input').val('');
      }
      */
    });
    /*
     * Reset form
     */
    $(':input:text').val('');
    $(':input:checkbox').removeAttr('checked');
    event.preventDefault();
    $('#addNewZone').modal('hide');
    return false;
  });
  /*
  $('#createNewLight input').keydown(function(e) {
    if (e.keyCode == 13) {
      $('#createNewLight').submit();
    }
  });
  */
  //
  $('#modal-add-light').on('shown', function () {
    $('input:text:visible:first', this).focus();
  });
  $('#form-add-light').on('submit', function(ev) {
    $.ajax({
      type: "POST",
      url: "/api/lighting/lights",
      data: $(this).serialize(),
      success:function() {
        $(':input').val('');
      }
    });
    ev.preventDefault();
    $('#modal-add-light').modal('hide');
    return false;
  });
  /*
   * Zone edit
   */
  $(document).on('click', '.open-modal-edit-zone', function() {
    var zoneId = $(this).data('id');
    var zoneName = $(this).data('name');
    var zoneDescription = $(this).data('description');
    $(':input:checkbox').each(function(index, cbox) {
      cbox.checked = false;
      $.each(lighting.zones[zoneId - 1].lights, function(index, light) {
        if (cbox.value == light) {
          cbox.checked = true;
        }
      });
    });
    $('#edit-zone-id').val(zoneId);
    $('#name').val(zoneName);
    $('#description').val(zoneDescription);
  });
  $('#form-edit-zone').on('submit', function(event) {
    $.ajax({
      type: "PUT",
      url: "/api/lighting/zone/" + $('#edit-zone-id').val(),
      data: $(this).serialize(),
    });
    event.preventDefault();
    $('#modal-edit-zone').modal('hide');
    return false;
  });
  /*
   * Preset edit.  On clicking the 'Edit' button, update the form
   * values based on the data-id of this target.
   */
  $(document).on('click', '.open-modal-edit-preset', function() {
    var presetId = $(this).data('id');
    var presetName = $(this).data('name');
    var presetDescription = $(this).data('description');
    $('#edit-preset-id').val(presetId);
    $('#name').val(presetName);
    $('#description').val(presetDescription);
  });
  $('#form-edit-preset').on('submit', function(event) {
    var formvals = {
      'name': $('#name').val(),
      'description': $('#description').val(),
    };
    $.ajax({
      type: "PUT",
      url: "/api/lighting/preset/" + $('#edit-preset-id').val(),
      data: formvals,
    });
    event.preventDefault();
    $('#modal-edit-preset').modal('hide');
    return false;
  });
  /*$('#modal-edit-preset input').keydown(function(e) {
    if (e.keyCode == 13) {
      $('#form-edit-preset').submit();
    }
  });*/
  /*
   * Colour wheel.
   */
  var wheel;
  $(document).on('click', '.open-modal-change-colour', function() {
    var zoneid = $(this).data('id');
    var pos = $('#colour-wheel').offset();
    var size = $('#colour-wheel').height();
    var startcolour = lighting.zones[zoneid].colour;
    $('#colour-wheel').css('background-color', '#' + startcolour);
    $('#modal-change-colour').data('start-colour', startcolour);
    $('#modal-change-colour').data('zone-id', zoneid);
    wheel = Raphael.colorwheel(pos.left, pos.top, 350, startcolour, 'colour-wheel');
    wheel.onchange = function(colour) {
      lighting.zones[zoneid].colour = colour;
      $('#colour-wheel').css('background-color', '#' + colour);
      $('#zone-bgcol-' + (zoneid + 1)).css("background-color", '#' + colour);
      socket.emit('setZoneColour', {
        'zoneid': zoneid,
        'colour': colour,
      });
    };
    socket.on('emitZones', function(data) {
      lighting = data;
      $.each(lighting.zones, function(index, zone) {
        if (index === zoneid) {
          wheel.color(zone.colour);
        }
      });
    });
  });
  $(document).on('click', '#modal-change-colour .revert-colour', function() {
    var zoneid = $('#modal-change-colour').data('zone-id');
    var colour = $('#modal-change-colour').data('start-colour');
    var revert = {
      'zoneid': zoneid,
      'colour': colour,
    };
    $('#zone-bgcol-' + (zoneid + 1)).css("background-color", '#' + colour);
    lighting.zones[revert.zoneid].colour = revert.colour;
    socket.emit('setZoneColour', revert);
  });
  $(document).on('hide', '#modal-change-colour', function() {
    wheel.remove();
  });
  /*
   * Preset save.  On clicking the 'Save' button, update the form
   * values based on the data-id of this target.
   */
  $(document).on('click', '.open-modal-save-preset', function() {
    var presetId = $(this).data('id');
    $('#save-preset-id').val(presetId);
  });
  $('#form-save-preset').on('submit', function(ev) {
    $.ajax({
      type: "PUT",
      url: "/api/lighting/preset/" + $('#save-preset-id').val(),
      data: {"save": true}
    });
    ev.preventDefault();
    $('#modal-save-preset').modal('hide');
    return false;
  });
  /*
   * Delete zone
   */
  $(document).on('click', '.open-modal-delete-zone', function() {
    $('#delete-zone-id').val($(this).data('id'));
  });
  $('#form-delete-zone').on('submit', function(ev) {
    $.ajax({
      type: "DELETE",
      url: "/api/lighting/zone/" + $('#delete-zone-id').val(),
    });
    ev.preventDefault();
    $('#modal-delete-zone').modal('hide');
    return false;
  });
  /*
   * Lights modify..
   */
  $(document).on('click', '.open-modal-delete-light', function() {
    $('#delete-light-id').val($(this).data('id'));
  });
  $('#form-delete-light').on('submit', function(ev) {
    $.ajax({
      type: "DELETE",
      url: "/api/lighting/light/" + $('#delete-light-id').val(),
    });
    ev.preventDefault();
    $('#modal-delete-light').modal('hide');
    return false;
  });
  /*
   * Power control
   */
  $('#modal-add-power-switch').on('shown', function () {
    $('input:text:visible:first', this).focus();
  });
  $('#form-add-power-switch').on('submit', function(ev) {
    $.ajax({
      type: "POST",
      url: "/api/power/switches",
      data: $(this).serialize(),
      success:function() {
        $(':input').val('');
      }
    });
    ev.preventDefault();
    $('#modal-add-power-switch').modal('hide');
    return false;
  });
  $(document).on('click', '.open-modal-edit-power-switch', function() {
    $('#edit-power-switch-id').val($(this).data('id'));
    $('#edit-power-switch-description').val($(this).data('description'));
  });
  $('#form-edit-power-switch').on('submit', function(ev) {
    $.ajax({
      type: "PUT",
      url: "/api/power/switch/" + $('#edit-power-switch-id').val(),
      data: $(this).serialize(),
    });
    ev.preventDefault();
    $('#modal-edit-power-switch').modal('hide');
    return false;
  });
  $(document).on('click', '.open-modal-delete-power-switch', function() {
    $('#delete-power-switch-id').val($(this).data('id'));
  });
  $('#form-delete-power-switch').on('submit', function(ev) {
    $.ajax({
      type: "DELETE",
      url: "/api/power/switch/" + $('#delete-power-switch-id').val(),
    });
    ev.preventDefault();
    $('#modal-delete-power-switch').modal('hide');
    return false;
  });

  $(document).on('click', '.set-power-switch', function() {
    $.ajax({
      type: "PUT",
      url: "/api/power/switch/" + $(this).data('id'),
      data: {"state": $(this).data('action')},
    });
  });

  /*
   * Preset button click
   */
  $('.btn-preset').on('click', function(ev) {
    socket.socket.reconnect();
    socket.emit('setPreset', $(this).data('id'));
    /*
     * Reset all buttons then make active primary
     */
    $('.btn-preset').removeClass('btn-preset-active').addClass('btn-preset-inactive');
    $(this).removeClass('btn-preset-inactive').addClass('btn-preset-active').button('refresh');
  });
});
