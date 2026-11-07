// A release build must be a GUI binary: without this the PE subsystem defaults
// to console and Windows opens a terminal window behind the widget at startup.
// Debug builds keep the console so `println!` and panic output stay visible.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    class_schedule_widget_lib::run();
}
