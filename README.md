# d3-su-picker

A d3-based SU (Seismic Unix) viewer and picker.  The viewer is built
on `nwjs`, a technology that let's one run web-based applications on
the desktop.  The display is
through `d3`, a javascript library for visualization.

This tool allows one to _pick_ the times of events of interest in a
seismic file and save the picks to a text file.

## suServer - a python script to provide data

Javascript does not have a segy reader, thus we use python to read su
and segy files and serve them to the picker through `WebSockets`.

## Installation

Download nwjs  (http://nwjs.io)

Install `node` (http://nodejs.org), which includes `npm` (the node
package manager)

Install `bower` (another package manager(?))
    npm install bower -g
  
    git clone https://github.com/sanandak/d3-su-picker
    cd d3-su-picker
    # install the required packages
    bower install
    npm install

Install python 3.4 or higher (preferably through anaconda (http://continuum.io))

    conda config --add channels conda-forge
    conda install obspy
    conda install websockets

## Requirements

  These are installed by `npm` and `bower`
  - d3js v4
  - sprintf-js
  - angularjs

  These are installed by `conda` (`pip` may work - untested)
  - obspy
  - websockets
  - numpy and scipy are installed with obspy
  
## Usage

    /path/to/nwjs /path/to/d3-su-picker

  Buttons to open an SU file and to save picks.

The viewer displays the first _ensemble_ (by default, the first `ffid` - field file id). 

Keyboard commands:
- `j` and `k` move the cursor forward and back in time by one sample.
- `J` and `K` move the cursor by 10 samples
- `h` and `l` move the cursor to the next/previous trace
- `H` and `L` move the cursor by 10 traces
- `N` and `P` displays the next/previous ensemble
- `z` and `Z` zoom in and out in time
- `t` and `T` zoom in and out in space (fewer and more traces are displayed)
- `p` picks the time of the cursor
- `d` deletes the pick

The saved picks file is a JSON file that is an array of traces.
- sufile: file name of the picked data
- picktime: when the picking was done
- picks: an array of traces

Each array member is a _trace_ object with the following fields:
- `pickT`- the time of the pick
- `pickIdx` - the sample number
- 'pickVal` - the value
- `tracl` - see SU docs for the definition of these fields
- `tracr`
- `ffid` 
- `tracf`
- `ep` 
- `cdp`
- `cdpt`
- `offset`
- `sx` 
- `sy` 
- `gx` 
- `gy` 
- `ns` 
- `dt` 
- `samps` (an array) - the full seismic trace

Each member of `samps` is an object with `t` and `v` fields: `{t: 0, v: .01}`

## TODO

  - Read SEG-Y files.
  - Read pick files.


  


