// See https://aka.ms/new-console-template for more information

using TehBilly.CSharp.SomeLibrary;

ISomeLibrary lib = new SomeLibrary();

Console.WriteLine($"SomeLibrary version: {lib.Version()}");
Console.WriteLine($"Flipping the string 'Hello, World!': {lib.FlipAString("Hello, World!")}");
