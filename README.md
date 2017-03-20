# d3-su-picker

A d3-based SU (Seismic Unix) viewer and picker.

## Installation

  git clone https://github.com/sanandak/d3-su-picker
  
## Usage

  Download `nwjs` from http://nwjs.io

    /path/to/nwjs /path/to/d3-su-picker

  Cmd-O to open an SU file
  Cmd-S to save picks

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

The saved picks file is a JSON file that is an array of traces.  Each array member is a _trace_ object with the following fields:
- `tracl`
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
- `samps` (an array)

Each member of `samps` is an object with `t` and `v` fields: `{t: 0, v: .01}`


  


